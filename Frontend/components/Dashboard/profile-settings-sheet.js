/**
 * Right-hand profile sheet: avatar upload (Supabase Storage), username edit, read-only email/name.
 * Expects globals: SUPABASE_URL, SUPABASE_ANON_KEY from ../onboarding/config.js
 * Optional: SUPABASE_AVATARS_BUCKET (defaults to "avatars")
 */
const DEFAULT_BUCKET = "avatars";

function getBucket() {
  if (typeof SUPABASE_AVATARS_BUCKET !== "undefined" && SUPABASE_AVATARS_BUCKET) {
    return String(SUPABASE_AVATARS_BUCKET).trim();
  }
  return DEFAULT_BUCKET;
}

class ProfileSettingsSheet extends HTMLElement {
  constructor() {
    super();
    this.pendingFile = null;
    this.currentAvatarUrl = null;
    this.userId = null;
    /** True while upload + DB save runs (blocks dismiss via backdrop/Escape) */
    this._saving = false;
  }

  connectedCallback() {
    this.render();
    this.cacheRefs();
    this.bindEvents();
  }

  cacheRefs() {
    this.backdrop = this.querySelector("[data-profile-sheet-backdrop]");
    this.panel = this.querySelector("[data-profile-sheet-panel]");
    this.formEmail = this.querySelector("#profile-sheet-email");
    this.formFullName = this.querySelector("#profile-sheet-fullname");
    this.formUsername = this.querySelector("#profile-sheet-username");
    this.preview = this.querySelector("#profile-sheet-preview");
    this.fileInput = this.querySelector("#profile-sheet-file");
    this.errorEl = this.querySelector("#profile-sheet-error");
    this.saveBtn = this.querySelector("#profile-sheet-save");
    this.signOutBtn = this.querySelector("#profile-sheet-signout");
  }

  render() {
    this.innerHTML = `
      <div
        data-profile-sheet-backdrop
        class="profile-sheet-backdrop"
        role="dialog"
        aria-modal="true"
        aria-label="Profile settings"
        aria-hidden="true"
      >
        <div data-profile-sheet-panel class="profile-sheet-panel">
          <div class="profile-sheet-header">
            <h2 class="profile-sheet-title">Profile</h2>
            <button
              type="button"
              class="profile-sheet-close"
              data-profile-sheet-close
              aria-label="Close profile settings"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="profile-sheet-body space-y-5">
            <div>
              <p class="modal-label mb-2">Photo</p>
              <div class="flex items-center gap-4">
                <div
                  id="profile-sheet-preview"
                  class="profile-sheet-avatar-preview flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#6D28D9] text-lg font-bold text-white"
                >
                  —
                </div>
                <div class="min-w-0 flex-1">
                  <input
                    id="profile-sheet-file"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    class="modal-input cursor-pointer py-2 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-violet-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-violet-800"
                  />
                  <p class="mt-1 text-[11px] text-slate-400">JPG, PNG, WebP or GIF. Max ~5MB recommended.</p>
                </div>
              </div>
            </div>

            <div>
              <label class="modal-label" for="profile-sheet-email">Email</label>
              <input id="profile-sheet-email" type="email" class="modal-input bg-slate-50 text-slate-500" disabled />
            </div>

            <div>
              <label class="modal-label" for="profile-sheet-fullname">Full name</label>
              <input id="profile-sheet-fullname" type="text" class="modal-input bg-slate-50 text-slate-500" disabled />
            </div>

            <div>
              <label class="modal-label" for="profile-sheet-username">Username</label>
              <input id="profile-sheet-username" type="text" class="modal-input" autocomplete="username" />
            </div>

            <p id="profile-sheet-error" class="hidden rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert"></p>

            <div class="flex flex-col gap-2 pt-1">
              <button
                type="button"
                id="profile-sheet-save"
                class="w-full rounded-xl bg-[#2B0A6B] py-2.5 text-sm font-semibold text-white hover:bg-[#3d1299] transition-colors disabled:opacity-90 disabled:cursor-wait inline-flex items-center justify-center gap-2 min-h-[42px]"
                aria-live="polite"
              >
                <span
                  data-profile-sheet-save-spinner
                  class="hidden h-4 w-4 shrink-0 rounded-full border-2 border-white/25 border-t-white animate-spin"
                  aria-hidden="true"
                ></span>
                <span data-profile-sheet-save-label>Save changes</span>
              </button>
              <button
                type="button"
                id="profile-sheet-signout"
                class="w-full rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  bindEvents() {
    this.querySelector("[data-profile-sheet-close]")?.addEventListener("click", () => this.close());
    this.backdrop?.addEventListener("click", (e) => {
      if (e.target !== this.backdrop) return;
      if (this._saving) return;
      this.close();
    });
    this.fileInput?.addEventListener("change", () => this.onFileChange());
    this.saveBtn?.addEventListener("click", () => this.save());
    this.signOutBtn?.addEventListener("click", () => this.signOut());

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!this.backdrop?.classList.contains("open")) return;
      if (this._saving) return;
      this.close();
    });
  }

  getClient() {
    if (typeof SUPABASE_URL === "undefined" || typeof SUPABASE_ANON_KEY === "undefined") {
      throw new Error("Supabase config missing (SUPABASE_URL, SUPABASE_ANON_KEY)");
    }
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  showError(msg) {
    if (!this.errorEl) return;
    if (!msg) {
      this.errorEl.classList.add("hidden");
      this.errorEl.textContent = "";
      return;
    }
    this.errorEl.textContent = msg;
    this.errorEl.classList.remove("hidden");
  }

  /** Spinner + label + disable related controls while save/upload runs */
  setSavingState(isSaving) {
    this._saving = isSaving;
    if (!this.saveBtn) return;
    this.saveBtn.disabled = isSaving;
    this.saveBtn.setAttribute("aria-busy", isSaving ? "true" : "false");

    const spinner = this.saveBtn.querySelector("[data-profile-sheet-save-spinner]");
    const label = this.saveBtn.querySelector("[data-profile-sheet-save-label]");
    if (spinner) spinner.classList.toggle("hidden", !isSaving);
    if (label) label.textContent = isSaving ? "Saving…" : "Save changes";

    if (this.signOutBtn) this.signOutBtn.disabled = isSaving;
    if (this.formUsername) this.formUsername.disabled = isSaving;
    if (this.fileInput) this.fileInput.disabled = isSaving;

    const closeBtn = this.querySelector("[data-profile-sheet-close]");
    if (closeBtn) closeBtn.disabled = isSaving;
  }

  onFileChange() {
    const file = this.fileInput?.files?.[0];
    this.pendingFile = file || null;
    this.showError("");

    if (!file) {
      this.updatePreview(this.currentAvatarUrl, null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.showError("Image is too large. Please choose a file under 5MB.");
      this.fileInput.value = "";
      this.pendingFile = null;
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (!this.preview) return;
      this.preview.replaceChildren();
      const img = document.createElement("img");
      img.src = reader.result;
      img.alt = "";
      img.className = "h-full w-full rounded-full object-cover";
      this.preview.appendChild(img);
    };
    reader.readAsDataURL(file);
  }

  updatePreview(avatarUrl, initialsFallback) {
    if (!this.preview) return;
    if (avatarUrl) {
      this.preview.replaceChildren();
      const img = document.createElement("img");
      img.src = avatarUrl;
      img.alt = "";
      img.className = "h-full w-full rounded-full object-cover";
      this.preview.appendChild(img);
      return;
    }
    const t = (initialsFallback || "—").slice(0, 2).toUpperCase();
    this.preview.textContent = t;
  }

  async open() {
    if (typeof window.supabase === "undefined") {
      console.warn("Supabase JS not loaded");
      return;
    }
    this.showError("");
    this.pendingFile = null;
    if (this.fileInput) this.fileInput.value = "";

    this.backdrop?.classList.add("open");
    this.backdrop?.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    try {
      await this.loadForm();
    } catch (e) {
      console.error(e);
      this.showError(e.message || "Could not load profile.");
    }
  }

  close() {
    this.backdrop?.classList.remove("open");
    this.backdrop?.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  async loadForm() {
    const supabase = this.getClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      this.showError("You need to be signed in to edit your profile.");
      return;
    }

    this.userId = user.id;
    if (this.formEmail) this.formEmail.value = user.email || "";

    const meta = user.user_metadata || {};
    const metaFullName = meta.full_name || meta.fullName || meta.name || "";

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, username, avatar_url")
      .eq("user_id", user.id)
      .maybeSingle();

    const fullName = profile?.full_name || metaFullName;
    const username = profile?.username || meta.username || "";
    const avatarUrl = profile?.avatar_url || null;

    this.currentAvatarUrl = avatarUrl;

    if (this.formFullName) this.formFullName.value = fullName || "";
    if (this.formUsername) this.formUsername.value = username || "";

    const source = (fullName || username || "").trim();
    const parts = source.split(/\s+/).filter(Boolean);
    const initials =
      parts.length >= 2
        ? (parts[0][0] + parts[1][0]).toUpperCase()
        : source.length >= 2
          ? source.slice(0, 2).toUpperCase()
          : "—";

    this.updatePreview(avatarUrl, initials);
  }

  async save() {
    this.showError("");
    const supabase = this.getClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      this.showError("Session expired. Please sign in again.");
      return;
    }

    const usernameRaw = (this.formUsername?.value || "").trim();
    if (!usernameRaw) {
      this.showError("Username cannot be empty.");
      return;
    }
    if (usernameRaw.length > 40) {
      this.showError("Username is too long (max 40 characters).");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, username, avatar_url")
      .eq("user_id", user.id)
      .maybeSingle();

    const meta = user.user_metadata || {};
    const metaFullName = meta.full_name || meta.fullName || meta.name || "";
    const fullName = profile?.full_name || metaFullName || "";

    let avatarUrl = profile?.avatar_url || this.currentAvatarUrl || null;

    this.setSavingState(true);
    try {
      if (this.pendingFile) {
        const bucket = getBucket();
        const ext = (this.pendingFile.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        const path = `${user.id}/${Date.now()}.${ext}`;

        const { error: upError } = await supabase.storage.from(bucket).upload(path, this.pendingFile, {
          upsert: true,
          contentType: this.pendingFile.type || "image/jpeg",
        });

        if (upError) {
          throw new Error(upError.message || "Upload failed. Check Storage bucket name and policies.");
        }

        const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
        avatarUrl = pub?.publicUrl || null;
        if (!avatarUrl) {
          throw new Error("Could not get public URL for the image. Is the bucket public?");
        }
      }

      const payload = {
        user_id: user.id,
        email: user.email,
        full_name: fullName,
        username: usernameRaw,
        avatar_url: avatarUrl,
      };

      const { error: upRowError } = await supabase.from("profiles").upsert(payload, {
        onConflict: "user_id",
      });

      if (upRowError) {
        throw new Error(upRowError.message || "Could not save profile.");
      }

      this.currentAvatarUrl = avatarUrl;
      this.pendingFile = null;
      if (this.fileInput) this.fileInput.value = "";

      if (typeof window.refreshDashboardProfile === "function") {
        await window.refreshDashboardProfile();
      }

      this.close();
    } catch (e) {
      console.error(e);
      this.showError(e.message || "Something went wrong.");
    } finally {
      this.setSavingState(false);
    }
  }

  async signOut() {
    try {
      const supabase = this.getClient();
      await supabase.auth.signOut();
    } catch (e) {
      console.error(e);
    }
    window.location.href = "../onboarding/login.html";
  }
}

customElements.define("profile-settings-sheet", ProfileSettingsSheet);
