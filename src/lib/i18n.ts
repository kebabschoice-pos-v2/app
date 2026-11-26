import { useCallback, useEffect, useState } from "react";
import i18nextInstance from "@/i18n/config";
import idLocaleJson from "@/locales/id.json";
import enLocaleJson from "@/locales/en.json";
import { supabase } from "@/integrations/supabase/client";

export type AppLanguage = "id" | "en";

export const LANGUAGE_STORAGE_KEY = "kebabschoicepos_language";
export const LANGUAGE_CHANGED_EVENT = "language:changed";

export interface SupportedLanguageOption {
  code: AppLanguage;
  iso: "ID" | "EN";
  nativeName: string;
  englishName: string;
  descriptionId: string;
  descriptionEn: string;
}

export const SUPPORTED_LANGUAGES: readonly SupportedLanguageOption[] = [
  {
    code: "id",
    iso: "ID",
    nativeName: "Bahasa Indonesia",
    englishName: "Indonesian",
    descriptionId: "Bahasa utama operasional kasir & manajemen cabang di Indonesia.",
    descriptionEn: "Primary language for POS cashier & branch operations in Indonesia.",
  },
  {
    code: "en",
    iso: "EN",
    nativeName: "English",
    englishName: "English",
    descriptionId: "Antarmuka lengkap berbahasa Inggris secara real-time.",
    descriptionEn: "Full English interface updated instantly in real time.",
  },
] as const;

export const DICTIONARY: Record<AppLanguage, Record<string, string>> = {
  id: {
    // Sidebar Icon Rail & Navigation
    "rail.cashier": "Kasir",
    "rail.orders": "Pesanan",
    "rail.shift": "Shift",
    "rail.stock": "Stok",
    "rail.attendance": "Absen",
    "rail.profile": "Profil",
    "rail.hq": "HQ",
    "rail.cashier_title": "Layar Kasir POS",
    "rail.orders_title": "Riwayat Pesanan, Void & Cetak Struk",
    "rail.shift_open_title": "Shift Aktif — Kelola Kas Laci",
    "rail.shift_closed_title": "Shift Tutup — Buka Shift Kasir",
    "rail.stock_title": "Cek Stok Cabang",
    "rail.attendance_title": "Absensi & Jadwal Shift",
    "rail.profile_title": "Profil Kasir & Pengaturan Akun",
    "rail.hq_title": "Kembali ke Dashboard HQ (1-Klik)",
    "rail.whatsapp": "WhatsApp",
    "rail.whatsapp_title": "Buka WhatsApp (Tab Baru)",

    // Header & Common
    "header.back_to_hq": "Kembali ke HQ",
    "header.enter_pos": "Masuk POS",
    "header.fullscreen_exit": "Keluar Fullscreen",
    "header.fullscreen_enter": "Layar Penuh (Tablet)",
    "header.theme_customize": "Kustomisasi Tema UI",
    "header.system_language": "Bahasa Sistem",
    "header.profile_settings": "Pengaturan Profil",
    "nav.logout": "Keluar / Logout",
    "common.pos": "POS Kasir",
    "common.search": "Cari transaksi, menu, pelanggan, atau outlet...",
    "common.cancel": "Batal",
    "common.close": "Tutup",
    "common.save": "Simpan Perubahan",
    "common.active": "Aktif",

    // POS Toolbar & Catalog
    "pos.search_menu": "Cari menu...",
    "pos.all": "Semua",
    "pos.variants": "Varian",
    "pos.shift_open": "Shift Aktif",
    "pos.shift_closed": "Shift Tutup",
    "pos.branch_fallback": "Cabang",
    "pos.stock_short": "Stok",
    "pos.menu_not_found": "tidak ditemukan",
    "pos.search_empty_desc": "Coba kata kunci lain atau hapus pencarian untuk melihat seluruh katalog.",
    "pos.outlet_empty_desc": "Menu mungkin belum diaktifkan untuk outlet ini. Anda dapat mengaktifkannya di Menu Management tab Cabang Outlet.",
    "pos.show_all_menu": "Tampilkan Semua Menu",
    "pos.mobile_cart": "Keranjang",

    // Smart Cart & 3-Step Checkout
    "cart.title": "Smart Cart",
    "cart.no_menu_in_outlet": "Tidak ada menu tersedia di outlet ini",
    "cart.empty_title": "Keranjang kosong",
    "cart.empty_subtitle": "Ketuk kartu menu di kiri untuk langsung menambah pesanan pelanggan.",
    "cart.held": "Tertahan",
    "cart.subtotal": "Subtotal",
    "cart.discount": "Diskon",
    "cart.cashier_discount": "Diskon Kasir",
    "cart.total_bill": "Total Tagihan",
    "cart.hold": "Tahan",
    "cart.pay": "Bayar",
    "cart.payment_method": "Metode Pembayaran",
    "pos.step2_badge": "Langkah 2 dari 3",
    "pos.step2_title": "Data Pesanan & Pelanggan",
    "pos.guest": "Umum",
    "pos.member": "Member",
    "pos.search_member": "Cari nama atau no. HP member...",
    "pos.select_member": "Pilih Member Terdaftar",
    "pos.active_member": "Member Aktif",
    "pos.order_type": "Tipe Pesanan",
    "pos.coming_soon": "segera hadir",
    "pos.customer_name": "Nama Pelanggan",
    "pos.customer_name_placeholder": "Contoh: Budi / Antrean 12",
    "pos.wa_optional": "No. WA (Opsional)",
    "pos.wa_placeholder": "0812xxxx (Kirim Struk WA)",
    "pos.continue_to_payment": "Lanjut ke Pembayaran",
    "pos.step3_badge": "Langkah 3 dari 3",
    "pos.edit_details": "Ubah Data",
    "pos.payment_title": "Pembayaran Pesanan",
    "pos.cash": "Tunai",
    "pos.transfer": "Transfer",
    "pos.exact_cash": "Uang Pas",
    "pos.exact_short": "Pas",
    "pos.short_cash": "Kurang Bayar",
    "pos.change": "Kembalian",
    "pos.processing": "Memproses...",
    "pos.show_qris": "Tampilkan QRIS",
    "pos.complete_and_print": "Selesaikan & Cetak Struk",
    "pos.add_to_cart": "Tambah ke Keranjang",
    "pos.required_choice": "Pilihan wajib dipilih",
    "pos.optional_choice": "Opsional",
    "pos.multi_choice": "Bisa pilih >1",
    "pos.special_notes_placeholder": "Catatan pesanan khusus (opsional, cth: saus dipisah)...",
    "pos.held_modal_title": "Antrean Pesanan Ditahan",
    "pos.held_modal_empty": "Tidak ada antrean pesanan yang sedang ditahan.",
    "pos.restore_to_cart": "Pulihkan ke Keranjang Aktif",
    "pos.send_wa_receipt": "Kirim Struk WA",
    "pos.print_receipt": "Cetak Struk",

    // Profile Settings Menu List (/profile & /pos/profile)
    "profile.back": "← Kembali",
    "profile.settings_header": "Pengaturan Aplikasi & Perangkat",
    "profile.account_name": "Nama Akun",
    "profile.registered_email": "Email Terdaftar",
    "profile.role_branch": "Role & Cabang",
    "profile.current_device": "Perangkat Saat Ini",
    "profile.menu_display_title": "Tampilan & Perangkat Kasir",
    "profile.menu_display_sub": "Ukuran Layar 80%–100%, Tampilan Menu Kotak/Normal/List, Sound Effect",
    "profile.menu_printer_title": "Printer Thermal & Struk",
    "profile.menu_printer_sub": "Bluetooth, RawBT Android, USB, 58mm/80mm, Test Print, Buka Laci",
    "profile.menu_theme_title": "Tema Warna & Mode",
    "profile.menu_theme_sub": "Light / Dark / System & Warna Tema",
    "profile.menu_language_title": "Bahasa Aplikasi",
    "profile.menu_language_sub": "Bahasa Indonesia / English",
    "profile.menu_security_title": "Keamanan & Password",
    "profile.menu_security_sub": "Ganti Password & PIN Supervisor khusus Owner/Manager",
    "profile.menu_login_title": "Riwayat Login",
    "profile.menu_login_sub": "Daftar sesi login aktif",
    "profile.menu_logout_title": "Keluar Akun (Logout)",
    "profile.menu_logout_sub": "Akhiri sesi kasir atau akun pada perangkat ini",
    "profile.ui_scale_title": "Ukuran Tampilan (80% – 100%)",
    "profile.ui_scale_auto": "Otomatis 85% di Tablet",
    "profile.ui_scale_desc": "Mengatur skala proporsional seluruh halaman Kasir, Pesanan, Shift, Stok, & Absensi.",
    "profile.view_mode_title": "Tampilan Menu (Kotak Padat | Normal | List)",
    "profile.view_mode_badge": "Katalog Kasir",
    "profile.view_mode_desc": "Pilih kepadatan kartu produk di layar kasir agar muat banyak tanpa perlu scroll jauh.",
    "profile.sound_title": "Sound Effect Sentuh Kasir",
    "profile.sound_desc": "Umpan balik suara instan saat mengetuk kartu menu, opsi varian, dan tombol bayar (100% offline).",
    "profile.test_sound": "Tes Suara",
    "profile.printer_panel_title": "Printer Thermal & Laci Kas",
    "profile.browser_dialog": "Dialog Browser",
    "profile.paper_size_label": "Ukuran Kertas Struk",
    "profile.test_print": "Tes Print",
    "profile.open_drawer": "Buka Laci",
    "profile.change_password_title": "Ganti Password Akun",
    "profile.change_password_desc": "Perbarui kata sandi login untuk akun",
    "profile.new_password": "Password Baru",
    "profile.new_password_placeholder": "Minimal 6 karakter",
    "profile.confirm_password": "Konfirmasi Password Baru",
    "profile.confirm_password_placeholder": "Ketik ulang password baru",
    "profile.saving": "Menyimpan...",
    "profile.save_password": "Simpan Password Baru",
    "profile.supervisor_pin_title": "PIN Otorisasi Supervisor (Void & Refund)",
    "profile.supervisor_pin_desc": "PIN 4–6 digit angka untuk menyetujui pembatalan transaksi (Void) dan Refund di POS.",
    "profile.save_pin": "Simpan PIN",
    "profile.login_history_title": "Riwayat Sesi Login",
    "profile.login_history_desc": "Perangkat dan sesi autentikasi pada akun ini.",
    "profile.current_session": "Sesi Ini",
    "profile.history_badge": "Riwayat",
    "profile.branch_assignment": "Penugasan Cabang",
    "profile.verified_role": "Role terverifikasi",
    "profile.logout_confirm_title": "Konfirmasi Keluar Akun",
    "profile.logout_confirm_desc": "Anda akan keluar dari sesi akun pada perangkat ini. Pastikan transaksi di keranjang sudah selesai atau ditahan.",
    "profile.logout_now": "Keluar Akun Sekarang",

    // Language Settings Page
    "language.title": "Bahasa Aplikasi",
    "language.subtitle": "Pilih bahasa tampilan KebabsChoicePOS. Seluruh menu Kasir & Profil langsung berganti secara real-time tanpa muat ulang.",
    "language.supported_badge": "2 Bahasa Aktif",
    "language.active_language": "Bahasa Aktif Saat Ini",
    "language.in_use": "Digunakan",
    "language.choose_label": "Pilih Bahasa Tampilan",
    "language.toast_changed": "Bahasa aplikasi diubah ke",
    "language.toast_desc": "Seluruh tampilan diperbarui secara real-time.",

    // Theme Modal / Inline
    "theme.inline_title": "Kustomisasi Tema Warna & Mode Tampilan",
    "theme.inline_desc": "Pilih mode terang/gelap dan warna utama antarmuka aplikasi secara langsung.",
    "theme.modal_title": "Kustomisasi Tema UI",
    "theme.modal_desc": "Pilih mode tampilan & warna aksen aplikasi",
    "theme.appearance_label": "Mode Tampilan (Appearance)",
    "theme.brand_color_label": "Warna Utama & Aksen (Brand Color)",
    "theme.done": "Selesai",

    // Orders (/pos/orders & /orders)
    "orders.title": "Orders & Transaksi",
    "orders.subtitle": "Riwayat lengkap transaksi seluruh cabang outlet, status pembayaran, kasir, dan data CRM.",
    "orders.filter_outlet": "Filter Outlet",
    "orders.all_outlets_option": "Semua Cabang Outlet",
    "orders.locked": "Terkunci",
    "orders.period_all": "Semua",
    "orders.period_today": "Hari Ini",
    "orders.period_7days": "7 Hari",
    "orders.period_month": "Bulan Ini",
    "orders.search_placeholder": "Cari order # / member...",
    "orders.total_orders_filtered": "Total Order Terfilter",
    "orders.transactions_unit": "Transaksi",
    "orders.revenue_filtered": "Omzet Bersih Terfilter",
    "orders.outlet_status": "Status Outlet",
    "orders.all_connected": "Semua Cabang Terhubung",
    "orders.no_orders_match": "Tidak Ada Transaksi yang Cocok",
    "orders.no_orders_match_desc": "Belum ada order untuk filter ini atau kata kunci pencarian Anda.",
    "orders.detail_btn": "Detail",

    // Shift & Cash (/pos/shift-cash)
    "shift.page_title": "Shift & Kas Laci Kasir",
    "shift.page_sub": "Buka shift, mutasi kas, & rekonsiliasi.",
    "shift.branch_label": "Cabang",
    "shift.active_badge": "Shift Aktif",
    "shift.closed_badge": "Shift Tutup",
    "shift.open_new_title": "Buka Shift Kasir Baru",
    "shift.open_new_desc": "Pilih kasir, kru pendamping, & modal awal laci kas.",
    "shift.active_outlet": "Outlet Aktif",
    "shift.cashier_on_duty": "Nama Kasir Bertugas *",
    "shift.quick_pick_cashier": "Pilih Cepat Kasir Cabang:",
    "shift.companion_crew": "Kru Pendamping (Opsional)",
    "shift.schedule_today": "Jadwal Tim Cabang Hari Ini",
    "shift.opening_float_label": "Modal Awal Kasir (Uang Kembalian)",
    "shift.open_shift_btn": "Buka Shift Sekarang",
    "shift.opening_cash": "Modal Awal",
    "shift.cash_sales": "Penjualan Tunai",
    "shift.cash_in_out": "Kas Masuk/Keluar",
    "shift.expected_cash": "Ekspektasi Kas",
    "shift.drawer_actions_title": "Aksi Kas Laci (+ Kas Masuk / - Kas Keluar)",
    "shift.cash_in_btn": "+ Kas Masuk",
    "shift.cash_out_btn": "- Kas Keluar",
    "shift.amount_label": "Nominal (Rp)",
    "shift.notes_label": "Keterangan",
    "shift.save_movement_btn": "Simpan Mutasi Kas",
    "shift.close_reconcile_title": "Tutup Shift & Rekonsiliasi",
    "shift.close_reconcile_desc": "Hitung uang fisik laci kasir saat pergantian shift.",
    "shift.close_shift": "Tutup Shift",
    "shift.shift_history": "Riwayat Shift",
    "shift.shifts_completed": "shift selesai",
    "shift.no_history": "Belum ada riwayat penutupan shift sebelumnya di cabang ini.",

    // POS Inventory (/pos/inventory)
    "pos_inv.page_title": "Inventory & Stok Outlet (POS)",
    "pos_inv.monitoring_sub": "Monitoring sisa stok real-time",
    "pos_inv.refresh_btn": "Refresh Stok",
    "pos_inv.request_hq_btn": "Minta Stok ke HQ",
    "pos_inv.daily_mutation_title": "Ringkasan Mutasi Bahan Hari Ini",
    "pos_inv.search_placeholder": "Cari bahan / kemasan / saus...",
    "pos_inv.all_categories": "Semua Kategori",
    "pos_inv.table_title": "Daftar Persediaan Bahan di Outlet",
    "pos_inv.items_recorded": "bahan terdata",
    "pos_inv.empty_title": "Tidak Ada Data Bahan Baku",
    "pos_inv.col_item": "Nama Bahan / Item",
    "pos_inv.col_category": "Kategori",
    "pos_inv.col_stock": "Sisa Stok",
    "pos_inv.col_min": "Batas Minimum",
    "pos_inv.col_status": "Status",
    "pos_inv.col_action": "Aksi",
    "pos_inv.equivalent": "Setara ±",
    "pos_inv.status_safe": "Aman",
    "pos_inv.status_low": "Menipis",
    "pos_inv.status_critical": "Kritis",
    "pos_inv.request_more": "Minta Tambah",
    "pos_inv.request_history_title": "Riwayat Permintaan Stok ke HQ",
    "pos_inv.modal_title": "Permintaan Stok ke Gudang Pusat",

    // POS Attendance (/pos/attendance-in)
    "att.biometric_badge": "Biometrik Wajah Asli",
    "att.page_title": "Absensi & Jadwal Shift Karyawan",
    "att.tab_in": "Absensi Masuk",
    "att.tab_out": "Absensi Keluar",
    "att.tab_history": "Riwayat",
    "att.tab_shifts": "Jadwal Shift",
    "att.cam_in": "Kamera Masuk Kerja",
    "att.cam_out": "Kamera Pulang Shift",
    "att.ai_ready": "128D Siap",
    "att.ai_loading": "Memuat AI...",
    "att.cam_inactive": "Kamera Belum Aktif",
    "att.enable_cam": "Aktifkan Kamera",
    "att.no_pin_biometric": "Tanpa PIN · Verifikasi Biometrik",
    "att.refresh_cam": "Refresh Kamera",
    "att.select_staff_title": "Pilih Karyawan & Verifikasi Wajah",
    "att.active_branch": "Cabang aktif",
    "att.grace_note": "Toleransi keterlambatan 15 menit",
    "att.reenroll_btn": "Daftar Ulang Wajah",
    "att.face_registered": "Wajah Terdaftar",
    "att.face_unregistered": "Wajah Belum Terdaftar",
    "att.check_in_time": "Jam Masuk:",
    "att.check_out_time": "Jam Keluar:",
    "att.today_status": "Status Kehadiran Hari Ini:",
    "att.status_late": "Terlambat",
    "att.status_on_time": "Tepat Waktu",
    "att.status_not_yet": "Belum Absen",
    "att.verify_in_btn": "Verifikasi Wajah & Absen Masuk",
    "att.verify_out_btn": "Verifikasi Wajah & Absen Pulang",
    "att.history_title": "Riwayat Kehadiran Cabang",
    "att.shifts_title": "Jadwal Shift Kerja Operasional",
  },
  en: {
    // Sidebar Icon Rail & Navigation
    "rail.cashier": "Cashier",
    "rail.orders": "Orders",
    "rail.shift": "Shift",
    "rail.stock": "Stock",
    "rail.attendance": "Attendance",
    "rail.profile": "Profile",
    "rail.hq": "HQ",
    "rail.cashier_title": "POS Cashier Screen",
    "rail.orders_title": "Order History, Void & Print Receipt",
    "rail.shift_open_title": "Shift Open — Manage Cash Drawer",
    "rail.shift_closed_title": "Shift Closed — Open Cashier Shift",
    "rail.stock_title": "Check Branch Stock",
    "rail.attendance_title": "Attendance & Shift Schedule",
    "rail.profile_title": "Cashier Profile & Account Settings",
    "rail.hq_title": "Back to HQ Dashboard (1-Click)",
    "rail.whatsapp": "WhatsApp",
    "rail.whatsapp_title": "Open WhatsApp (New Tab)",

    // Header & Common
    "header.back_to_hq": "Back to HQ",
    "header.enter_pos": "Open POS",
    "header.fullscreen_exit": "Exit Fullscreen",
    "header.fullscreen_enter": "Fullscreen (Tablet)",
    "header.theme_customize": "Customize UI Theme",
    "header.system_language": "System Language",
    "header.profile_settings": "Profile Settings",
    "nav.logout": "Log Out",
    "common.pos": "POS Cashier",
    "common.search": "Search orders, menu, customers, or outlets...",
    "common.cancel": "Cancel",
    "common.close": "Close",
    "common.save": "Save Changes",
    "common.active": "Active",

    // POS Toolbar & Catalog
    "pos.search_menu": "Search menu...",
    "pos.all": "All",
    "pos.variants": "Variants",
    "pos.shift_open": "Shift Open",
    "pos.shift_closed": "Shift Closed",
    "pos.branch_fallback": "Branch",
    "pos.stock_short": "Stock",
    "pos.menu_not_found": "not found",
    "pos.search_empty_desc": "Try another keyword or clear search to view the full catalog.",
    "pos.outlet_empty_desc": "No menu enabled for this outlet yet. Enable items in Menu Management > Outlet Branches.",
    "pos.show_all_menu": "Show All Menu",
    "pos.mobile_cart": "Cart",

    // Smart Cart & 3-Step Checkout
    "cart.title": "Smart Cart",
    "cart.no_menu_in_outlet": "No menu available in this outlet",
    "cart.empty_title": "Cart is empty",
    "cart.empty_subtitle": "Tap any menu card on the left to add items to the order.",
    "cart.held": "Held",
    "cart.subtotal": "Subtotal",
    "cart.discount": "Discount",
    "cart.cashier_discount": "Cashier Discount",
    "cart.total_bill": "Total Bill",
    "cart.hold": "Hold",
    "cart.pay": "Pay",
    "cart.payment_method": "Payment Method",
    "pos.step2_badge": "Step 2 of 3",
    "pos.step2_title": "Order & Customer Details",
    "pos.guest": "Guest",
    "pos.member": "Member",
    "pos.search_member": "Search member name or phone...",
    "pos.select_member": "Select Registered Member",
    "pos.active_member": "Active Member",
    "pos.order_type": "Order Type",
    "pos.coming_soon": "coming soon",
    "pos.customer_name": "Customer Name",
    "pos.customer_name_placeholder": "e.g. Alex / Queue 12",
    "pos.wa_optional": "WhatsApp No. (Optional)",
    "pos.wa_placeholder": "0812xxxx (Send WA Receipt)",
    "pos.continue_to_payment": "Continue to Payment",
    "pos.step3_badge": "Step 3 of 3",
    "pos.edit_details": "Edit Details",
    "pos.payment_title": "Order Payment",
    "pos.cash": "Cash",
    "pos.transfer": "Transfer",
    "pos.exact_cash": "Exact",
    "pos.exact_short": "Exact",
    "pos.short_cash": "Amount Due",
    "pos.change": "Change",
    "pos.processing": "Processing...",
    "pos.show_qris": "Show QRIS",
    "pos.complete_and_print": "Complete & Print Receipt",
    "pos.add_to_cart": "Add to Cart",
    "pos.required_choice": "Required",
    "pos.optional_choice": "Optional",
    "pos.multi_choice": "Select >1",
    "pos.special_notes_placeholder": "Special order notes (optional, e.g. sauce on the side)...",
    "pos.held_modal_title": "Held Orders Queue",
    "pos.held_modal_empty": "No held orders at the moment.",
    "pos.restore_to_cart": "Restore to Active Cart",
    "pos.send_wa_receipt": "Send WA Receipt",
    "pos.print_receipt": "Print Receipt",

    // Profile Settings Menu List (/profile & /pos/profile)
    "profile.back": "← Back",
    "profile.settings_header": "App & Device Settings",
    "profile.account_name": "Account Name",
    "profile.registered_email": "Registered Email",
    "profile.role_branch": "Role & Branch",
    "profile.current_device": "Current Device",
    "profile.menu_display_title": "Cashier Display & Device",
    "profile.menu_display_sub": "Screen Scale 80%–100%, Grid/Normal/List Menu View, Sound Effects",
    "profile.menu_printer_title": "Thermal Printer & Receipt",
    "profile.menu_printer_sub": "Bluetooth, RawBT Android, USB, 58mm/80mm, Test Print, Open Drawer",
    "profile.menu_theme_title": "Color Theme & Mode",
    "profile.menu_theme_sub": "Light / Dark / System & Accent Color",
    "profile.menu_language_title": "App Language",
    "profile.menu_language_sub": "Bahasa Indonesia / English",
    "profile.menu_security_title": "Security & Password",
    "profile.menu_security_sub": "Change Password & Supervisor PIN for Owner/Manager",
    "profile.menu_login_title": "Login History",
    "profile.menu_login_sub": "Active login sessions & devices",
    "profile.menu_logout_title": "Log Out Account",
    "profile.menu_logout_sub": "Sign out from your account on this device",
    "profile.ui_scale_title": "Display Scale (80% – 100%)",
    "profile.ui_scale_auto": "Auto 85% on Tablet",
    "profile.ui_scale_desc": "Adjusts proportional UI scale across Cashier, Orders, Shift, Stock & Attendance.",
    "profile.view_mode_title": "Menu Layout (Compact Grid | Normal | List)",
    "profile.view_mode_badge": "Cashier Catalog",
    "profile.view_mode_desc": "Choose product card density on the cashier screen to fit more items without scrolling.",
    "profile.sound_title": "Cashier Touch Sound Effects",
    "profile.sound_desc": "Instant audio feedback when tapping menu cards, variants, and pay buttons (100% offline).",
    "profile.test_sound": "Test Sound",
    "profile.printer_panel_title": "Thermal Printer & Cash Drawer",
    "profile.browser_dialog": "Browser Dialog",
    "profile.paper_size_label": "Receipt Paper Width",
    "profile.test_print": "Test Print",
    "profile.open_drawer": "Open Drawer",
    "profile.change_password_title": "Change Account Password",
    "profile.change_password_desc": "Update the login password for",
    "profile.new_password": "New Password",
    "profile.new_password_placeholder": "Minimum 6 characters",
    "profile.confirm_password": "Confirm New Password",
    "profile.confirm_password_placeholder": "Re-enter new password",
    "profile.saving": "Saving...",
    "profile.save_password": "Save New Password",
    "profile.supervisor_pin_title": "Supervisor Authorization PIN (Void & Refund)",
    "profile.supervisor_pin_desc": "4–6 digit numeric PIN to authorize Void and Refund actions at the POS.",
    "profile.save_pin": "Save PIN",
    "profile.login_history_title": "Login Session History",
    "profile.login_history_desc": "Authenticated devices and active sessions for this account.",
    "profile.current_session": "Current Session",
    "profile.history_badge": "History",
    "profile.branch_assignment": "Branch Assignment",
    "profile.verified_role": "Verified role",
    "profile.logout_confirm_title": "Confirm Account Log Out",
    "profile.logout_confirm_desc": "You will sign out from this device. Make sure any active cart order is completed or placed on hold.",
    "profile.logout_now": "Log Out Now",

    // Language Settings Page
    "language.title": "App Language",
    "language.subtitle": "Choose the KebabsChoicePOS display language. All POS & Profile menus switch instantly in real time without reload.",
    "language.supported_badge": "2 Active Languages",
    "language.active_language": "Currently Active Language",
    "language.in_use": "Active",
    "language.choose_label": "Select Display Language",
    "language.toast_changed": "App language changed to",
    "language.toast_desc": "All screens updated instantly in real time.",

    // Theme Modal / Inline
    "theme.inline_title": "Color Theme & Appearance Mode",
    "theme.inline_desc": "Choose light/dark mode and the primary brand accent color instantly.",
    "theme.modal_title": "Customize UI Theme",
    "theme.modal_desc": "Select appearance mode & brand accent color",
    "theme.appearance_label": "Appearance Mode",
    "theme.brand_color_label": "Brand Accent Color",
    "theme.done": "Done",

    // Orders (/pos/orders & /orders)
    "orders.title": "Orders & Transactions",
    "orders.subtitle": "Complete transaction history across all outlet branches, payment status, cashier, and CRM.",
    "orders.filter_outlet": "Filter Outlet",
    "orders.all_outlets_option": "All Outlet Branches",
    "orders.locked": "Locked",
    "orders.period_all": "All",
    "orders.period_today": "Today",
    "orders.period_7days": "7 Days",
    "orders.period_month": "This Month",
    "orders.search_placeholder": "Search order # / member...",
    "orders.total_orders_filtered": "Filtered Orders",
    "orders.transactions_unit": "Transactions",
    "orders.revenue_filtered": "Filtered Net Revenue",
    "orders.outlet_status": "Outlet Status",
    "orders.all_connected": "All Branches Connected",
    "orders.no_orders_match": "No Matching Transactions",
    "orders.no_orders_match_desc": "No orders found for this filter or search keyword.",
    "orders.detail_btn": "Details",

    // Shift & Cash (/pos/shift-cash)
    "shift.page_title": "Cashier Shift & Drawer",
    "shift.page_sub": "Open shift, cash movements, & reconciliation.",
    "shift.branch_label": "Branch",
    "shift.active_badge": "Shift Open",
    "shift.closed_badge": "Shift Closed",
    "shift.open_new_title": "Open New Cashier Shift",
    "shift.open_new_desc": "Select cashier, companion crew, & opening cash float.",
    "shift.active_outlet": "Active Outlet",
    "shift.cashier_on_duty": "Cashier on Duty *",
    "shift.quick_pick_cashier": "Quick Select Branch Cashier:",
    "shift.companion_crew": "Companion Crew (Optional)",
    "shift.schedule_today": "Today's Branch Team Schedule",
    "shift.opening_float_label": "Opening Cash Float",
    "shift.open_shift_btn": "Open Shift Now",
    "shift.opening_cash": "Opening Cash",
    "shift.cash_sales": "Cash Sales",
    "shift.cash_in_out": "Cash In/Out",
    "shift.expected_cash": "Expected Cash",
    "shift.drawer_actions_title": "Cash Drawer Actions (+ Cash In / - Cash Out)",
    "shift.cash_in_btn": "+ Cash In",
    "shift.cash_out_btn": "- Cash Out",
    "shift.amount_label": "Amount (Rp)",
    "shift.notes_label": "Description",
    "shift.save_movement_btn": "Save Cash Movement",
    "shift.close_reconcile_title": "Close Shift & Reconcile",
    "shift.close_reconcile_desc": "Count physical cash in the drawer when ending the shift.",
    "shift.close_shift": "Close Shift",
    "shift.shift_history": "Shift History",
    "shift.shifts_completed": "completed shifts",
    "shift.no_history": "No closed shift history recorded for this branch yet.",

    // POS Inventory (/pos/inventory)
    "pos_inv.page_title": "Outlet Inventory & Stock (POS)",
    "pos_inv.monitoring_sub": "Real-time remaining stock monitor",
    "pos_inv.refresh_btn": "Refresh Stock",
    "pos_inv.request_hq_btn": "Request Stock from HQ",
    "pos_inv.daily_mutation_title": "Today's Ingredient Mutations",
    "pos_inv.search_placeholder": "Search ingredients / packaging / sauces...",
    "pos_inv.all_categories": "All Categories",
    "pos_inv.table_title": "Outlet Ingredient Stock List",
    "pos_inv.items_recorded": "items recorded",
    "pos_inv.empty_title": "No Ingredient Data Found",
    "pos_inv.col_item": "Ingredient / Item",
    "pos_inv.col_category": "Category",
    "pos_inv.col_stock": "Remaining Stock",
    "pos_inv.col_min": "Minimum Stock",
    "pos_inv.col_status": "Status",
    "pos_inv.col_action": "Action",
    "pos_inv.equivalent": "Approx. ±",
    "pos_inv.status_safe": "Safe",
    "pos_inv.status_low": "Low",
    "pos_inv.status_critical": "Critical",
    "pos_inv.request_more": "Request More",
    "pos_inv.request_history_title": "Stock Request History to HQ",
    "pos_inv.modal_title": "Request Stock from Central Warehouse",

    // POS Attendance (/pos/attendance-in)
    "att.biometric_badge": "Live Face Biometrics",
    "att.page_title": "Staff Attendance & Shift Schedule",
    "att.tab_in": "Check In",
    "att.tab_out": "Check Out",
    "att.tab_history": "History",
    "att.tab_shifts": "Shift Schedule",
    "att.cam_in": "Check-In Camera",
    "att.cam_out": "Check-Out Camera",
    "att.ai_ready": "128D Ready",
    "att.ai_loading": "Loading AI...",
    "att.cam_inactive": "Camera Not Active",
    "att.enable_cam": "Enable Camera",
    "att.no_pin_biometric": "PIN-Free · Biometric Verification",
    "att.refresh_cam": "Refresh Camera",
    "att.select_staff_title": "Select Staff & Verify Face",
    "att.active_branch": "Active branch",
    "att.grace_note": "15-minute late grace period",
    "att.reenroll_btn": "Re-enroll Face",
    "att.face_registered": "Face Enrolled",
    "att.face_unregistered": "Face Not Enrolled",
    "att.check_in_time": "Check-In Time:",
    "att.check_out_time": "Check-Out Time:",
    "att.today_status": "Today's Attendance Status:",
    "att.status_late": "Late",
    "att.status_on_time": "On Time",
    "att.status_not_yet": "Not Checked In",
    "att.verify_in_btn": "Verify Face & Check In",
    "att.verify_out_btn": "Verify Face & Check Out",
    "att.history_title": "Branch Attendance History",
    "att.shifts_title": "Operational Shift Schedule",
  },
};

const NESTED_LOCALES: Record<AppLanguage, Record<string, any>> = {
  id: idLocaleJson as Record<string, any>,
  en: enLocaleJson as Record<string, any>,
};

export function normalizeAppLanguage(code: unknown): AppLanguage {
  if (typeof code === "string" && code.trim().toLowerCase().startsWith("en")) {
    return "en";
  }
  return "id";
}

export function getStoredLanguage(): AppLanguage {
  if (typeof window === "undefined") return "id";
  try {
    const raw = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return normalizeAppLanguage(raw);
  } catch {
    return "id";
  }
}

function lookupNestedKey(obj: Record<string, any>, dottedKey: string): string | undefined {
  const parts = dottedKey.split(".");
  let cur: any = obj;
  for (const part of parts) {
    if (cur && typeof cur === "object" && part in cur) {
      cur = cur[part];
    } else {
      return undefined;
    }
  }
  return typeof cur === "string" ? cur : undefined;
}

export function translateText(lang: AppLanguage, key: string, fallback?: string): string {
  const direct = DICTIONARY[lang]?.[key];
  if (typeof direct === "string") return direct;

  const nested = lookupNestedKey(NESTED_LOCALES[lang], key);
  if (typeof nested === "string") return nested;

  return fallback !== undefined ? fallback : key;
}

export async function setLanguage(nextLang: AppLanguage, userId?: string | null): Promise<void> {
  const normalized = normalizeAppLanguage(nextLang);
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
      document.documentElement.lang = normalized;
      document.documentElement.dir = "ltr";
    } catch {}

    window.dispatchEvent(
      new CustomEvent(LANGUAGE_CHANGED_EVENT, { detail: { language: normalized } }),
    );
    window.dispatchEvent(
      new CustomEvent("languagechange", { detail: { language: normalized } }),
    );
  }

  try {
    if (i18nextInstance.language !== normalized) {
      await i18nextInstance.changeLanguage(normalized);
    }
  } catch {}

  if (userId) {
    try {
      await supabase.from("profiles").update({ language: normalized }).eq("user_id", userId);
    } catch {}
  }
}

export function useTranslation() {
  const [language, setLanguageState] = useState<AppLanguage>(() => getStoredLanguage());

  useEffect(() => {
    const syncFromEvent = (e: Event) => {
      const detailLang = (e as CustomEvent<{ language?: string }>)?.detail?.language;
      setLanguageState(detailLang ? normalizeAppLanguage(detailLang) : getStoredLanguage());
    };
    const syncFromStorage = (e: StorageEvent) => {
      if (!e.key || e.key === LANGUAGE_STORAGE_KEY) {
        setLanguageState(getStoredLanguage());
      }
    };

    setLanguageState(getStoredLanguage());
    window.addEventListener(LANGUAGE_CHANGED_EVENT, syncFromEvent);
    window.addEventListener("languagechange", syncFromEvent);
    window.addEventListener("storage", syncFromStorage);
    return () => {
      window.removeEventListener(LANGUAGE_CHANGED_EVENT, syncFromEvent);
      window.removeEventListener("languagechange", syncFromEvent);
      window.removeEventListener("storage", syncFromStorage);
    };
  }, []);

  const t = useCallback(
    (key: string, fallback?: string): string => translateText(language, key, fallback),
    [language],
  );

  const changeLanguage = useCallback(async (next: AppLanguage, userId?: string | null) => {
    const normalized = normalizeAppLanguage(next);
    setLanguageState(normalized);
    await setLanguage(normalized, userId);
  }, []);

  return {
    t,
    language,
    lang: language,
    isEnglish: language === "en",
    setLanguage: changeLanguage,
    i18n: {
      language,
      changeLanguage,
      on: i18nextInstance.on.bind(i18nextInstance),
      off: i18nextInstance.off.bind(i18nextInstance),
    },
  };
}
