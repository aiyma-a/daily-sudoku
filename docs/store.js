"use strict";
// The one place the game reads and writes saved data on the phone (localStorage).
// Every call is safe: a full, blocked or corrupt store gives the default instead
// of stopping the game.
window.Store = (function () {
  const get = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const set = (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) { /* storage full or blocked */ } };
  return {
    get, set,
    remove(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
    // A saved object; `dflt` when missing, empty or unreadable.
    json(k, dflt) { try { return JSON.parse(get(k)) || dflt; } catch (e) { return dflt; } },
    setJson(k, v) { set(k, JSON.stringify(v)); },
  };
})();
