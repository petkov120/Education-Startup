class DashboardSidebar extends HTMLElement {
  static observedAttributes = ["active-item"];

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  render() {
    const activeItem = (this.getAttribute("active-item") || "home").toLowerCase();
    const shellBase = (this.getAttribute("data-shell-base") || "").trim();

    const navItems = [
      {
        id: "home",
        label: "Home",
        icon: "/Images/dashboard-icons/home.svg",
        href: "/Frontend/components/Dashboard/dp.html",
      },
      {
        id: "exam-home",
        label: "Exam Home",
        icon: "/Images/dashboard-icons/Exam Prep.svg",
        href: "/Frontend/components/exam-prep/exam-home.html",
      },
      {
        id: "resources",
        label: "Resources",
        icon: "/Images/dashboard-icons/ChalkboardTeacher.svg",
        href: "#",
      },
      {
        id: "my-learning",
        label: "My Learning",
        icon: "/Images/dashboard-icons/Student.svg",
        href: "/Frontend/components/learning-path/index.html",
      },
      {
        id: "ai-buddy",
        label: "AI Buddy",
        icon: "/Images/dashboard-icons/Robot.svg",
        href: "#",
      },
      {
        id: "analytics",
        label: "Analytics",
        icon: "/Images/dashboard-icons/Vector.svg",
        href: "#",
      },
    ];

    const navLinks = navItems
      .map((item) => {
        const activeClass = item.id === activeItem ? " active" : "";
        const href =
          shellBase && item.href !== "#" && ["home", "exam-home", "my-learning"].includes(item.id)
            ? `${shellBase}#${item.id}`
            : item.href;
        return `
          <a href="${href}" class="nav-item${activeClass}" aria-label="${item.label}" data-nav-id="${item.id}">
            <img src="${item.icon}" alt="" />
            <span class="nav-label">${item.label}</span>
          </a>
        `;
      })
      .join("");

    this.innerHTML = `
      <nav id="sidebar" aria-label="Main navigation">
        <div class="sidebar-logo-row" style="height: 77px; margin-bottom: 0; align-items: center;">
          <div class="flex-shrink-0 w-9 h-9 rounded-lg bg-white flex items-center justify-center">
            <img src="/Images/cool%201.png" alt="Openxp" class="h-7 w-7 object-contain" />
          </div>
          <div class="sidebar-logo-text flex flex-col">
            <span class="sidebar-logo-title text-sm font-semibold leading-tight">Openxp</span>
            <span class="sidebar-logo-subtitle text-[11px]">Study Dashboard</span>
          </div>
        </div>

        ${navLinks}

        <div class="nav-spacer"></div>
        <a href="#" class="nav-item" aria-label="Settings">
          <img src="/Images/dashboard-icons/Gear.svg" alt="" />
          <span class="nav-label">Settings</span>
        </a>
      </nav>
    `;
  }
}

customElements.define("dashboard-sidebar", DashboardSidebar);
