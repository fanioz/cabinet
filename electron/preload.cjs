/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("CabinetDesktop", {
  runtime: "electron",
  platform: process.platform,
  /**
   * Trigger the in-app macOS uninstall flow. Returns
   * `{ ok: true, dataPath }` on success — the renderer should show a
   * confirmation toast referencing `dataPath` so the user knows their
   * cabinet content is preserved.
   */
  uninstallApp: () => ipcRenderer.invoke("cabinet:uninstall-app"),
  /**
   * The OS keyboard / input languages, most-preferred first, plus the
   * Electron app + system locale. Used on the first onboarding screen to
   * localize Cabinet out of the box. Renderer maps these BCP-47 tags onto a
   * shipped locale; an explicit user choice always wins over this.
   */
  getPreferredLanguages: () =>
    ipcRenderer.invoke("cabinet:get-preferred-languages"),
});
