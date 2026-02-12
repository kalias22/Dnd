export type TabletopAppHandle = {
  mountEl: HTMLDivElement;
  destroy: () => void;
};

export const createTabletopApp = (containerEl: HTMLDivElement): TabletopAppHandle => {
  const mountEl = document.createElement("div");
  mountEl.style.position = "relative";
  mountEl.style.width = "100%";
  mountEl.style.height = "100%";
  containerEl.appendChild(mountEl);

  const destroy = () => {
    const canvases = mountEl.querySelectorAll("canvas");
    for (const canvas of canvases) {
      canvas.remove();
    }
    if (mountEl.parentElement === containerEl) {
      containerEl.removeChild(mountEl);
    } else {
      mountEl.remove();
    }
  };

  return { mountEl, destroy };
};
