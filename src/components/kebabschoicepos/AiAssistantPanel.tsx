import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Bot, Loader2 } from "lucide-react";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { calculateSnapshotMetrics, type Snapshot } from "./data";

interface ChatMessageItem {
  id: string;
  role: "user" | "assistant";
  text: string;
}

const initialChatMessages: ChatMessageItem[] = [
  {
    id: "kitapos-ai-welcome",
    role: "assistant",
    text: "Selamat pagi, Admin. Saya sudah memantau revenue, stok, dan pola pelanggan hari ini. Tanyakan apa yang perlu diprioritaskan.",
  },
];

function ConversationScrollACLEButton() {
  return <ConversationScrollButton className="bottom-5" />;
}

export function AiAssistantPanel({ snapshot }: { snapshot: Snapshot }) {
  const { t } = useTranslation();
  const metrics = calculateSnapshotMetrics(snapshot);
  const [messages, setMessages] = useState<ChatMessageItem[]>(initialChatMessages);
  const [isLoading, setIsLoading] = useState(false);

  const handleSendPrompt = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessageItem = {
      id: `user-${Date.now()}`,
      role: "user",
      text: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      const res = await fetch("/api/kitapos-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          prompt: trimmed,
          businessId: snapshot.businessId || undefined,
          businessName: snapshot.businessName,
          metrics,
          products: snapshot.products.slice(0, 15),
          inventory: snapshot.inventory.slice(0, 15),
          customers: snapshot.customers.slice(0, 10),
          orders: snapshot.orders.slice(0, 25),
          outlets: snapshot.outlets || [],
        }),
      });

      const json = await res.json().catch(() => null);

      if (json && typeof json.message === "string" && json.message.trim()) {
        setMessages((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            role: "assistant",
            text: json.message,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            role: "assistant",
            text: "AI sedang tidak tersedia, menggunakan analisis internal.",
          },
        ]);
      }
    } catch (err) {
      console.error("[AiAssistantPanel] fetch error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: "assistant",
          text: "AI sedang tidak tersedia, menggunakan analisis internal.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="flex h-[42rem] min-h-0 flex-col rounded-[1.75rem] border border-border bg-card/86 shadow-float backdrop-blur-2xl">
      <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-muted text-foreground/75">
            <Bot className="size-5" />
          </div>
          <div>
            <h2 className="font-black tracking-normal">
              {t("dashboard.ai_assistant_title", "Kita AI Assistant")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("dashboard.ai_assistant_desc", "Sales prediction · stok · pelanggan")}
            </p>
          </div>
        </div>
        <span className="rounded-full bg-success-soft px-3 py-1 text-xs font-bold text-success-foreground">
          Online
        </span>
      </div>

      <Conversation className="min-h-0">
        <ConversationContent className="gap-5 p-5">
          {messages.length === 0 && (
            <ConversationEmptyState
              icon={<Bot className="size-7" />}
              title="Tanya Kita AI"
              description="Minta rekomendasi stok, promo, atau ringkasan penjualan."
            />
          )}
          {messages.map((message) => (
            <Message key={message.id} from={message.role}>
              <MessageContent
                className={cn(message.role === "user" && "bg-primary text-primary-foreground")}
              >
                <MessageResponse>{message.text}</MessageResponse>
              </MessageContent>
            </Message>
          ))}
          {isLoading && (
            <Message from="assistant">
              <MessageContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin text-primary" />
                  {t("dashboard.ai_reading_pattern", "Kita AI sedang membaca pola bisnis...")}
                </div>
              </MessageContent>
            </Message>
          )}
        </ConversationContent>
        <ConversationScrollACLEButton />
      </Conversation>

      <div className="border-t border-border p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {[
            "Produk paling laku hari ini?",
            "Outlet dengan omzet tertinggi?",
            "Stok apa yang perlu dibeli?",
          ].map((prompt) => (
            <Button
              key={prompt}
              variant="secondary"
              size="sm"
              className="rounded-full text-xs font-semibold"
              onClick={() => handleSendPrompt(prompt)}
            >
              {prompt}
            </Button>
          ))}
        </div>
        <PromptInput
          onSubmit={({ text }) => {
            handleSendPrompt(text);
          }}
        >
          <PromptInputTextarea
            placeholder={t("dashboard.ask_ai_placeholder", "Tanya: apa prioritas bisnis hari ini?")}
          />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={isLoading ? "submitted" : "ready"} className="rounded-xl" />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </section>
  );
}

export default AiAssistantPanel;
