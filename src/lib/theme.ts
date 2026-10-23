export type ThemeChoice = "light" | "dark";

export const THEME_STORAGE_KEY = "igw-theme";

/**
 * Runs in <head> before first paint (see layout.tsx). Without a saved
 * choice, globals.css follows prefers-color-scheme.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;
