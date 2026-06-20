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

  function getAppUrl() {
    if (location.pathname.indexOf("/First") !== -1) {
      return location.origin + "/First/";
    }
    return location.origin + "/";
  }

  function getAppPath() {
    return location.pathname.indexOf("/First") !== -1 ? "/First/" : "/";
  }

  function notifyListeners(session, event) {
    listeners.forEach((listener) => listener(session, event));
  }

  function isEmailConfirmationReturn() {
    const hash = location.hash || "";
    const search = location.search || "";
    return (
      hash.includes("access_token") ||
      hash.includes("type=signup") ||
      search.includes("code=") ||
      search.includes("token_hash=")
    );
  }

  function clearAuthParamsFromUrl() {
    if (!isEmailConfirmationReturn()) return;
    history.replaceState(null, "", getAppPath());
  }

  function init() {
    if (!isConfigured()) {
      return false;
    }

    supabase = window.supabase.createClient(
      window.SUPABASE_URL,
      window.SUPABASE_ANON_KEY,
      {
        auth: {
          detectSessionInUrl: true,
          persistSession: true,
          autoRefreshToken: true,
          flowType: "pkce"
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      currentSession = session;
      notifyListeners(session, session ? "INITIAL_SESSION" : null);
      if (session && isEmailConfirmationReturn()) {
        clearAuthParamsFromUrl();
      }
    });

    supabase.auth.onAuthStateChange((event, session) => {
      currentSession = session;
      notifyListeners(session, event);
      if (
        session &&
        (event === "SIGNED_IN" || event === "INITIAL_SESSION") &&
        isEmailConfirmationReturn()
      ) {
        clearAuthParamsFromUrl();
      }
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

    return { data, error, needsEmailConfirmation: Boolean(data.user && !data.session) };
  }

  async function signIn(email, password) {
    if (!supabase) {
      return { error: { message: "Supabase is not configured." } };
    }

    const result = await supabase.auth.signInWithPassword({ email, password });

    if (!result.error && result.data.session) {
      const fullName = result.data.user?.user_metadata?.full_name;
      if (fullName) {
        await upsertProfile(result.data.user.id, fullName, email);
      }
    }

    return result;
  }

  async function resendConfirmation(email) {
    if (!supabase) {
      return { error: { message: "Supabase is not configured." } };
    }

    return supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: getAppUrl()
      }
    });
  }

  async function signOut() {
    if (!supabase) {
      return { error: { message: "Supabase is not configured." } };
    }

    return supabase.auth.signOut();
  }

  async function deleteAccount() {
    if (!supabase) {
      return { error: { message: "Supabase is not configured." } };
    }

    if (!currentSession) {
      return { error: { message: "You must be signed in to delete your account." } };
    }

    const { error: rpcError } = await supabase.rpc("delete_own_account");
    if (rpcError) {
      return { error: rpcError };
    }

    await supabase.auth.signOut();
    currentSession = null;
    notifyListeners(null, "SIGNED_OUT");

    return { error: null };
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
    callback(currentSession, null);
    return () => listeners.delete(callback);
  }

  window.Auth = {
    init,
    isConfigured,
    signUp,
    signIn,
    signOut,
    deleteAccount,
    resendConfirmation,
    getProfile,
    getSession,
    getAppUrl,
    onAuthStateChange,
    isEmailConfirmationReturn
  };
})();
