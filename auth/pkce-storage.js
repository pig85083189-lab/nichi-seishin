(function (global) {
  var STORAGE_KEY = "nichi-auth";
  var VERIFIER_KEY = STORAGE_KEY + "-code-verifier";

  function isVerifierKey(key) {
    return /code-verifier/i.test(String(key || ""));
  }

  function cookieGet(name) {
    var prefix = name + "=";
    var parts = String(document.cookie || "").split(";");
    for (var i = 0; i < parts.length; i += 1) {
      var part = parts[i].replace(/^\s+/, "");
      if (part.indexOf(prefix) === 0) {
        try {
          return decodeURIComponent(part.slice(prefix.length));
        } catch (error) {
          return part.slice(prefix.length);
        }
      }
    }
    return null;
  }

  function cookieSet(name, value) {
    var secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie =
      name +
      "=" +
      encodeURIComponent(String(value)) +
      "; Path=/; Max-Age=600; SameSite=Lax" +
      secure;
  }

  function cookieRemove(name) {
    var secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = name + "=; Path=/; Max-Age=0; SameSite=Lax" + secure;
  }

  function safeGet(store, key) {
    try {
      return store.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function safeSet(store, key, value) {
    try {
      store.setItem(key, value);
      return true;
    } catch (error) {
      return false;
    }
  }

  function safeRemove(store, key) {
    try {
      store.removeItem(key);
    } catch (error) {
      /* ignore */
    }
  }

  function collectVerifierKeys() {
    var keys = [VERIFIER_KEY];
    function addFromStore(store) {
      try {
        for (var i = 0; i < store.length; i += 1) {
          var key = store.key(i);
          if (key && isVerifierKey(key) && keys.indexOf(key) < 0) keys.push(key);
        }
      } catch (error) {
        /* ignore */
      }
    }
    addFromStore(localStorage);
    addFromStore(sessionStorage);
    String(document.cookie || "")
      .split(";")
      .forEach(function (part) {
        var name = part.replace(/^\s+/, "").split("=")[0];
        if (name && isVerifierKey(name) && keys.indexOf(name) < 0) keys.push(name);
      });
    return keys;
  }

  function createAuthStorage() {
    var memory = {};
    return {
      getItem: function (key) {
        return (
          memory[key] ||
          safeGet(localStorage, key) ||
          safeGet(sessionStorage, key) ||
          cookieGet(key) ||
          null
        );
      },
      setItem: function (key, value) {
        var text = String(value == null ? "" : value);
        memory[key] = text;
        safeSet(localStorage, key, text);
        safeSet(sessionStorage, key, text);
        if (isVerifierKey(key) && text && text.length <= 256) {
          cookieSet(key, text);
        }
      },
      removeItem: function (key) {
        delete memory[key];
        safeRemove(localStorage, key);
        safeRemove(sessionStorage, key);
        if (isVerifierKey(key)) cookieRemove(key);
      },
    };
  }

  function persistVerifierCopies() {
    var storage = createAuthStorage();
    var found = false;
    collectVerifierKeys().forEach(function (key) {
      var value = storage.getItem(key);
      if (!value) return;
      storage.setItem(key, value);
      found = true;
    });
    return found;
  }

  function readVerifier() {
    var storage = createAuthStorage();
    var keys = collectVerifierKeys();
    for (var i = 0; i < keys.length; i += 1) {
      var value = storage.getItem(keys[i]);
      if (value) return value;
    }
    return "";
  }

  function clearAuthArtifacts(options) {
    var keepSession = Boolean(options && options.keepSession);
    var storage = createAuthStorage();
    collectVerifierKeys().forEach(function (key) {
      storage.removeItem(key);
    });
    if (keepSession) return;
    try {
      var raw = safeGet(localStorage, STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : null;
      var hasSession = Boolean(
        parsed &&
          (parsed.access_token ||
            (parsed.currentSession && parsed.currentSession.access_token) ||
            (parsed.session && parsed.session.access_token))
      );
      if (!hasSession) {
        safeRemove(localStorage, STORAGE_KEY);
        safeRemove(sessionStorage, STORAGE_KEY);
      }
    } catch (error) {
      safeRemove(localStorage, STORAGE_KEY);
      safeRemove(sessionStorage, STORAGE_KEY);
    }
  }

  global.NichiAuthStorage = {
    STORAGE_KEY: STORAGE_KEY,
    VERIFIER_KEY: VERIFIER_KEY,
    createAuthStorage: createAuthStorage,
    persistVerifierCopies: persistVerifierCopies,
    readVerifier: readVerifier,
    clearAuthArtifacts: clearAuthArtifacts,
  };
})(window);
