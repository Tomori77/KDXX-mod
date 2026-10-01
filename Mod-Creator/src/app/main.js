import { catalogs, enums, VERSION } from "../generated/index.js";
import { zhCN } from "../i18n/zh-CN.js";

export function bootstrap() {
  const root = document.getElementById("app");
  if (!root) {
    return;
  }
  try {
    const itemCount = Array.isArray(catalogs.items) ? catalogs.items.length : 0;
    const categoryCount = Array.isArray(enums.addableCategories) ? enums.addableCategories.length : 0;
    root.innerHTML = "";
    const card = document.createElement("div");
    card.className = "card";
    const title = document.createElement("h1");
    title.textContent = zhCN.appTitle;
    const version = document.createElement("p");
    version.textContent = "SDK " + VERSION.sdkVersion + " · " + VERSION.generator;
    const ready = document.createElement("p");
    ready.textContent = zhCN.skeletonReady;
    const items = document.createElement("p");
    items.textContent = zhCN.officialItems + " " + itemCount + " · " + zhCN.categories + " " + categoryCount;
    card.appendChild(title);
    card.appendChild(version);
    card.appendChild(ready);
    card.appendChild(items);
    root.appendChild(card);
  } catch (error) {
    root.textContent = zhCN.startupError + "：" + (error && error.message ? error.message : String(error));
  }
}

bootstrap();
