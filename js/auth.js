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

  function getMasterEmail() {
    return window.MASTER_EMAIL || "master@digitalworld.local";
  }

  function getMasterPassword() {
    return window.MASTER_INITIAL_PASSWORD || "123456";
  }

  function isMaster(session) {
    if (!session?.user) return false;
    return (
      session.user.user_metadata?.role === "master" ||
      session.user.email === getMasterEmail()
    );
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

  async function signInMaster(password) {
    if (!supabase) {
      return { error: { message: "Supabase is not configured." } };
    }

    const email = getMasterEmail();
    const masterPassword = password || getMasterPassword();

    let result = await supabase.auth.signInWithPassword({
      email,
      password: masterPassword
    });

    if (result.error) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: masterPassword,
        options: {
          data: { full_name: "Master", role: "master" },
          emailRedirectTo: getAppUrl()
        }
      });

      if (error) {
        if (/already|registered|exists/i.test(error.message)) {
          return {
            error: {
              message:
                "Master account already exists. Check your password, or confirm the email in Supabase → Authentication → Users."
            }
          };
        }
        if (/password|least|characters|short/i.test(error.message)) {
          return {
            error: {
              message: `Password rejected: ${error.message} (Supabase requires at least 6 characters.)`
            }
          };
        }
        return { error };
      }

      if (data.session) {
        await upsertProfile(data.user.id, "Master", email);
        currentSession = data.session;
        notifyListeners(data.session, "SIGNED_IN");
        return { data, error: null, created: true };
      }

      result = await supabase.auth.signInWithPassword({
        email,
        password: masterPassword
      });

      if (result.error) {
        return {
          error: {
            message:
              "Master account created. Turn off email confirmation in Supabase, or confirm the email, then try again."
          },
          needsEmailConfirmation: true
        };
      }
    }

    if (result.data.session) {
      await upsertProfile(result.data.user.id, "Master", email);
    }

    return { ...result, created: false };
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

    await supabase.from("profiles").upsert(
      {
        id: userId,
        full_name: fullName,
        email
      },
      { onConflict: "id" }
    );
  }

  async function getProfile() {
    if (!supabase || !currentSession) {
      return { data: null, error: null };
    }

    return supabase
      .from("profiles")
      .select("full_name, email, created_at, digimon")
      .eq("id", currentSession.user.id)
      .maybeSingle();
  }

  async function getDigimonBalance() {
    const { data, error } = await getProfile();
    if (error || !data) {
      return { data: null, error };
    }

    return { data: data.digimon ?? 100, error: null };
  }

  async function getAllProfiles() {
    if (!supabase || !isMaster(currentSession)) {
      return { data: null, error: { message: "Master access required." } };
    }

    return supabase
      .from("profiles")
      .select("id, full_name, email, created_at, digimon")
      .order("created_at", { ascending: false });
  }

  function getSession() {
    return currentSession;
  }

  function getClient() {
    return supabase;
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
    signInMaster,
    signOut,
    deleteAccount,
    resendConfirmation,
    getProfile,
    getDigimonBalance,
    getAllProfiles,
    getSession,
    getClient,
    getAppUrl,
    getMasterEmail,
    isMaster,
    onAuthStateChange,
    isEmailConfirmationReturn
  };
})();
