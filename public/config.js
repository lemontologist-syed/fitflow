// FitFlow server settings.
// These three values are PUBLIC by design: anyone who opens the app can see them.
// NEVER put the Supabase secret key (sb_secret_... / service_role) or the
// VAPID PRIVATE key in this file.
// Leave them empty to use FitFlow in local-only mode (no sync, no push).
window.FITFLOW_CONFIG = {
  // Supabase Dashboard -> Project Settings -> Data API / API -> Project URL
  supabaseUrl: "",
  // Supabase Dashboard -> Project Settings -> API Keys -> Publishable key (sb_publishable_...)
  // (the legacy "anon public" key also works)
  supabaseAnonKey: "",
  // The PUBLIC key printed by GENERATE_KEYS.bat
  vapidPublicKey: "",
};
