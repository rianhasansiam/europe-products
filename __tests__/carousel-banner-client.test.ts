import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CarouselBanner, {
  type CarouselSlide,
} from "@/app/(shop)/components/CarouselBanner";

type Effect = () => void | (() => void);
type EffectSlot = { dependencies?: readonly unknown[]; cleanup?: () => void };

// Match the existing checkout client tests: run the real handlers and effects
// with deterministic state and dependency-aware cleanup, without a fake DOM.
const harness = vi.hoisted(() => ({
  states: [] as unknown[],
  stateCursor: 0,
  effects: [] as EffectSlot[],
  effectCursor: 0,
  pending: [] as { index: number; effect: Effect; dependencies?: readonly unknown[] }[],
  unsubscribe: undefined as (() => void) | undefined,
  notifications: 0,
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = harness.stateCursor++;
    if (index >= harness.states.length) harness.states.push(initial);
    return [harness.states[index], (next: unknown) => {
      harness.states[index] = typeof next === "function" ? next(harness.states[index]) : next;
    }];
  },
  useEffect: (effect: Effect, dependencies?: readonly unknown[]) => {
    const index = harness.effectCursor++;
    const previous = harness.effects[index];
    if (!previous || !dependencies || !previous.dependencies ||
      dependencies.length !== previous.dependencies.length ||
      dependencies.some((value, i) => !Object.is(value, previous.dependencies![i]))) {
      harness.pending.push({ index, effect, dependencies });
    }
  },
  useSyncExternalStore: (subscribe: (notify: () => void) => () => void, getSnapshot: () => boolean) => {
    harness.unsubscribe ??= subscribe(() => { harness.notifications++; });
    return getSnapshot();
  },
}));
vi.mock("@/components/i18n/translate", () => ({
  useInterfaceTranslations: () => (source: string) => source,
}));

const first: CarouselSlide = {
  id: "first", image: "/uploads/banners/first.webp", title: "First merchant title",
  subtitle: "First highlight", description: "First description", badge: "First badge",
  bgType: "solid", bgColor: "#112233", bgFrom: null, bgVia: null, bgTo: null,
  link: "/products?campaign=first",
};
const second: CarouselSlide = {
  ...first, id: "second", image: "/uploads/banners/second.webp", title: "Second merchant title",
  bgColor: "#445566", link: "/products?campaign=second",
};
const slides = [first, second];
const listeners = new Set<() => void>();
const media = {
  matches: false,
  addEventListener: vi.fn((_event: string, listener: () => void) => { listeners.add(listener); }),
  removeEventListener: vi.fn((_event: string, listener: () => void) => { listeners.delete(listener); }),
};

function renderHero(items = slides): ReactNode {
  harness.stateCursor = 0;
  harness.effectCursor = 0;
  harness.pending = [];
  const tree = CarouselBanner({ slides: items });
  for (const { index, effect, dependencies } of harness.pending) {
    harness.effects[index]?.cleanup?.();
    harness.effects[index] = { dependencies, cleanup: effect() || undefined };
  }
  return tree;
}

function unmount() {
  harness.effects.forEach((effect) => effect.cleanup?.());
  harness.unsubscribe?.();
  harness.effects = [];
  harness.unsubscribe = undefined;
}

function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Record<string, unknown> & { children?: ReactNode }>(node)) return [];
  return [node, ...elements(node.props.children)];
}

function control(tree: ReactNode, name: string) {
  const result = elements(tree).find((node) => node.type === "button" &&
    (node.props["aria-label"] === name || node.props.children === name));
  if (!result) throw new Error(`Missing hero control: ${name}`);
  return result;
}

function click(tree: ReactNode, name: string) {
  (control(tree, name).props.onClick as () => void)();
}

function selected(tree: ReactNode): string | undefined {
  return elements(tree).find((node) => node.type === "button" && node.props["aria-current"] === "true")
    ?.props["aria-label"] as string | undefined;
}

function section(tree: ReactNode) {
  const result = elements(tree).find((node) => node.type === "section");
  if (!result) throw new Error("Hero section was not rendered");
  return result.props;
}

function pagination(tree: ReactNode) {
  return elements(tree).filter((node) => node.type === "button" && node.props["aria-label"])
    .map((node) => node.props["aria-label"]);
}

beforeEach(() => {
  vi.useFakeTimers();
  harness.states = [];
  harness.stateCursor = 0;
  harness.effects = [];
  harness.pending = [];
  harness.unsubscribe = undefined;
  harness.notifications = 0;
  listeners.clear();
  media.matches = false;
  media.addEventListener.mockClear();
  media.removeEventListener.mockClear();
  vi.stubGlobal("window", {
    setInterval: vi.fn(globalThis.setInterval.bind(globalThis)),
    clearInterval: vi.fn(globalThis.clearInterval.bind(globalThis)),
    matchMedia: vi.fn(() => media),
  });
});

afterEach(() => {
  unmount();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("hero client rotation and controls", () => {
  it("does not autoplay under reduced motion, while manual pagination remains available", () => {
    media.matches = true;
    let tree = renderHero();
    expect(vi.getTimerCount()).toBe(0);
    expect(window.setInterval).not.toHaveBeenCalled();
    expect(pagination(tree)).toEqual(["Show banner 1", "Show banner 2"]);
    expect(elements(tree).some((node) => node.props.children === "Pause")).toBe(false);

    click(tree, "Show banner 2");
    tree = renderHero();
    expect(selected(tree)).toBe("Show banner 2");
    vi.advanceTimersByTime(12_000);
    expect(selected(renderHero())).toBe("Show banner 2");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rotates every three seconds and wraps without duplicating intervals or changing control labels", () => {
    let tree = renderHero();
    expect(selected(tree)).toBe("Show banner 1");
    expect(window.setInterval).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(2_999);
    expect(selected(renderHero())).toBe("Show banner 1");
    vi.advanceTimersByTime(1);
    tree = renderHero();
    expect(selected(tree)).toBe("Show banner 2");
    expect(pagination(tree)).toEqual(["Show banner 1", "Show banner 2"]);
    expect(window.setInterval).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(3_000);
    expect(selected(renderHero())).toBe("Show banner 1");
  });

  it("stops on Pause and resumes on Play with the selected banner intact", () => {
    let tree = renderHero();
    click(tree, "Pause");
    tree = renderHero();
    expect(control(tree, "Play").props["aria-pressed"]).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(9_000);
    expect(selected(renderHero())).toBe("Show banner 1");

    click(tree, "Play");
    tree = renderHero();
    expect(control(tree, "Pause").props["aria-pressed"]).toBe(false);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(3_000);
    expect(selected(renderHero())).toBe("Show banner 2");
  });

  it("pauses while hovered and resumes only after the pointer leaves", () => {
    let tree = renderHero();
    (section(tree).onMouseEnter as () => void)();
    tree = renderHero();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(6_000);
    expect(selected(renderHero())).toBe("Show banner 1");
    (section(tree).onMouseLeave as () => void)();
    renderHero();
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(3_000);
    expect(selected(renderHero())).toBe("Show banner 2");
  });

  it("keeps rotation paused while focus moves inside the hero and resumes when focus leaves", () => {
    let tree = renderHero();
    (section(tree).onFocusCapture as () => void)();
    tree = renderHero();
    expect(vi.getTimerCount()).toBe(0);
    const blur = section(tree).onBlurCapture as (event: {
      currentTarget: { contains: (target: unknown) => boolean }; relatedTarget: object | null;
    }) => void;
    blur({ currentTarget: { contains: () => true }, relatedTarget: {} });
    renderHero();
    vi.advanceTimersByTime(9_000);
    expect(vi.getTimerCount()).toBe(0);
    expect(selected(renderHero())).toBe("Show banner 1");
    blur({ currentTarget: { contains: () => false }, relatedTarget: null });
    renderHero();
    expect(vi.getTimerCount()).toBe(1);
  });

  it("reacts to a changed motion preference without losing manual controls", () => {
    renderHero();
    expect(vi.getTimerCount()).toBe(1);
    expect(media.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    media.matches = true;
    listeners.forEach((notify) => notify());
    let tree = renderHero();
    expect(harness.notifications).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
    expect(pagination(tree)).toEqual(["Show banner 1", "Show banner 2"]);
    click(tree, "Show banner 2");
    tree = renderHero();
    expect(selected(tree)).toBe("Show banner 2");
    media.matches = false;
    listeners.forEach((notify) => notify());
    renderHero();
    expect(vi.getTimerCount()).toBe(1);
  });

  it("cleans up the interval and motion subscription on unmount", () => {
    renderHero();
    expect(vi.getTimerCount()).toBe(1);
    expect(listeners.size).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(window.clearInterval).toHaveBeenCalledTimes(1);
    expect(listeners.size).toBe(0);
    expect(media.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("cleans up rotation and clamps selection when the published slide list shrinks", () => {
    let tree = renderHero();
    click(tree, "Show banner 2");
    expect(selected(renderHero())).toBe("Show banner 2");
    tree = renderHero([first]);
    expect(vi.getTimerCount()).toBe(0);
    expect(elements(tree).some((node) => node.type === "button")).toBe(false);
    expect(elements(tree).find((node) => "preload" in node.props)?.props.src).toBe(first.image);
    expect(renderHero([])).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("falls back to the saved background after an image error without losing content or slide navigation", () => {
    let tree = renderHero();
    const image = elements(tree).find((node) => "onError" in node.props);
    expect(image?.props.src).toBe(first.image);
    (image!.props.onError as () => void)();
    tree = renderHero();
    expect(section(tree)["data-has-image"]).toBe(false);
    expect(section(tree).style).toEqual({ "--hero-background": first.bgColor });
    expect(elements(tree).some((node) => "onError" in node.props)).toBe(false);
    expect(elements(tree).some((node) => node.props.children === first.description)).toBe(true);
    click(tree, "Show banner 2");
    tree = renderHero();
    expect(section(tree)["data-has-image"]).toBe(true);
    const nextImage = elements(tree).find((node) => "onError" in node.props);
    expect(nextImage?.props.src).toBe(second.image);
    expect(nextImage?.props.preload).toBe(false);
  });
});
