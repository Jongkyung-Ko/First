(function () {
  let supabase = null;
  let currentSession = null;
  const listeners = new Set();

  function isConfigured() {
    return (
      window.SUPABASE_URL &&
      window.SUPABASE_ANON_KEY &&
      window.SUPABASE_URL !== "https://YOUR_PROJECT.supabase.co" &&
      window.SUPABASE_ANON_KEY !== "YOUR_ANON_KEY"
    );
  }

  function notifyListeners(session) {
    listeners.forEach((listener) => listener(session));
  }

  function getAppUrl() {
    if (location.pathname.indexOf("/First") !== -1) {
      return location.origin + "/First/";
    }
    return location.origin + "/";
  }

  function init() {
    if (!isConfigured()) {
      return false;
    }

    supabase = window.supabase.createClient(
      window.SUPABASE_URL,
      window.SUPABASE_ANON_KEY
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      currentSession = session;
      notifyListeners(session);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      currentSession = session;
      notifyListeners(session);
    });

    return true;
  }

  async function signUp(email, password, fullName) {
    if (!supabase) {
      return { error: { message: "Supabase is not configured." } };
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: getAppUrl()
      }
    });

    if (error) {
      return { data, error };
    }

    if (data.user && data.session) {
      await upsertProfile(data.user.id, fullName, email);
    }

    return { data, error };
  }

  async function signIn(email, password) {
    if (!supabase) {
      return { error: { message: "Supabase is not configured." } };
    }

    return supabase.auth.signInWithPassword({ email, password });
  }

  async function signOut() {
    if (!supabase) {
      return { error: { message: "Supabase is not configured." } };
    }

    return supabase.auth.signOut();
  }

  async function upsertProfile(userId, fullName, email) {
    if (!supabase) return;

    await supabase.from("profiles").upsert({
      id: userId,
      full_name: fullName,
      email
    });
  }

  async function getProfile() {
    if (!supabase || !currentSession) {
      return { data: null, error: null };
    }

    return supabase
      .from("profiles")
      .select("full_name, email, created_at")
      .eq("id", currentSession.user.id)
      .maybeSingle();
  }

  function getSession() {
    return currentSession;
  }

  function onAuthStateChange(callback) {
    listeners.add(callback);
    callback(currentSession);
    return () => listeners.delete(callback);
  }

  window.Auth = {
    init,
    isConfigured,
    signUp,
    signIn,
    signOut,
    getProfile,
    getSession,
    onAuthStateChange
  };
})();
