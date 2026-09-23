"use client";

// ============================================================
// 第1层：引入外部依赖
// ============================================================
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
} from "framer-motion";
import {
  Archive,
  FolderKanban,
  Home,
  LibraryBig,
  Menu,
  Plus,
  Settings2,
  UserRound,
  X,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { navItems, siteConfig, type NavItem } from "@/content/site";
import { normalizeRoutePathname } from "@/lib/route-path";
import {
  resolveTransitionStageMinHeight,
  resolveWaitingContentMotion,
} from "@/lib/transition-stage";
import { cn } from "@/lib/utils";
import { RouteLink } from "./route-link";
import { ThemeToggleButton } from "./theme-toggle";
import {
  PageTransitionProvider,
  usePageTransition,
} from "./transition-context";

// 页面进入动画"稳定"后，再多等 680ms 才结束过渡，让动画播完
const ENTER_SETTLE_MS = 680;

// ============================================================
// 第2层：辅助函数（纯逻辑，不涉及 UI）
// ============================================================

// 把导航项的图标名称（字符串）映射成真正的 Lucide 图标组件
function resolveNavIcon(icon: NavItem["icon"]) {
  switch (icon) {
    case "home":
      return Home;
    case "archive":
      return Archive;
    case "projects":
      return FolderKanban;
    case "resources":
      return LibraryBig;
    case "about":
      return UserRound;
    default:
      return Home;
  }
}

// 判断当前路由是否匹配某个导航项
// 例如："/posts/xxx" 匹配 href="/posts" 的导航项
function isActiveRoute(pathname: string, item: NavItem) {
  return (item.match ?? [item.href]).some((entry) =>
    entry === "/"
      ? pathname === "/"
      : pathname === entry || pathname.startsWith(`${entry}/`),
  );
}

// 根据当前路径，找到对应的导航项（用于移动端显示当前页面名称）
function resolveCurrentNavItem(pathname: string) {
  return navItems.find((item) => isActiveRoute(pathname, item)) ?? navItems[0];
}

// ============================================================
// 第3层：子组件 —— 桌面端侧边导航栏
// ============================================================
function SideNavigation() {
  const pathname = usePathname();

  return (
    <aside className="shell-sidebar">
      <div>
        {/* 博客品牌标识（名称 + 副标题） */}
        <div className="mb-10 px-2">
          <RouteLink
            href="/"
            transitionKey="brand-mark"
            className="inline-flex flex-col gap-1"
          >
            <span className="font-heading text-[2rem] font-black tracking-[-0.07em] text-primary-strong">
              {siteConfig.name}
            </span>
            <span className="font-label text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
              Personal Blog
            </span>
          </RouteLink>
        </div>

        {/* 导航链接列表 */}
        <nav className="space-y-2">
          {navItems.map((item) => {
            const Icon = resolveNavIcon(item.icon);
            const active = isActiveRoute(pathname, item);

            return (
              <RouteLink
                key={item.href}
                href={item.href}
                transitionKey={item.transitionKey}
                className={cn(
                  "shell-nav-link",
                  active && "shell-nav-link-active",
                )}
              >
                <Icon className="relative z-10 h-[18px] w-[18px]" />
                <span className="relative z-10 flex items-baseline gap-2">
                  <span>{item.label}</span>
                  <span className="font-label text-[10px] uppercase tracking-[0.18em] opacity-80">
                    {item.eyebrow}
                  </span>
                </span>
                {/* 激活状态的指示器（利用 layoutId 实现平滑滑动效果） */}
                {active ? (
                  <motion.span
                    layoutId="active-nav-pill"
                    className="shell-nav-pill"
                  />
                ) : null}
              </RouteLink>
            );
          })}
        </nav>
      </div>

      {/* 底部：Markdown 编辑器入口 */}
      <RouteLink
        href="/editor"
        transitionKey="nav-editor"
        className="shell-editor-link"
      >
        <span className="theme-surface-ghost inline-flex h-8 w-8 items-center justify-center rounded-full">
          <Settings2 className="h-4 w-4" />
        </span>
        <span>Markdown Editor</span>
      </RouteLink>
    </aside>
  );
}

// ============================================================
// 第4层：子组件 —— 移动端导航栏（顶部条 + 抽屉菜单）
// ============================================================
function MobileNavigation({
  motionEnabled, // 是否开启动画（用户没禁用动效）
  mobileNavOpen, // 抽屉是否打开
  setMobileNavOpen, // 控制抽屉开关
}: {
  motionEnabled: boolean;
  mobileNavOpen: boolean;
  setMobileNavOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const pathname = normalizeRoutePathname(usePathname());
  const currentItem = resolveCurrentNavItem(pathname);

  return (
    <div className="shell-mobile-nav" data-route-overlay-ignore>
      {/* 顶部导航条：品牌名 + 当前页面名 + 汉堡菜单按钮 */}
      <div className="shell-mobile-nav-bar">
        <RouteLink
          href="/"
          transitionKey="mobile-brand-mark"
          className="shell-mobile-nav-brand"
        >
          <span className="shell-mobile-nav-brand-mark">WL</span>
          <span className="shell-mobile-nav-brand-copy">
            <span className="shell-mobile-nav-brand-name">
              {siteConfig.name}
            </span>
            <span className="shell-mobile-nav-divider" aria-hidden="true" />
            <span className="shell-mobile-nav-current">
              <span className="shell-mobile-nav-current-label">
                {currentItem.label}
              </span>
              <span className="shell-mobile-nav-current-eyebrow">
                {currentItem.eyebrow}
              </span>
            </span>
          </span>
        </RouteLink>

        {/* 汉堡/关闭 切换按钮 */}
        <button
          type="button"
          className={cn(
            "shell-mobile-nav-toggle",
            mobileNavOpen && "shell-mobile-nav-toggle-active",
          )}
          aria-expanded={mobileNavOpen}
          aria-controls="shell-mobile-nav-panel"
          aria-label={
            mobileNavOpen ? "Close navigation menu" : "Open navigation menu"
          }
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          <span className="shell-mobile-nav-toggle-icon" aria-hidden="true">
            {mobileNavOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
          </span>
        </button>
      </div>

      {/* AnimatePresence：抽屉打开/关闭时播放进出场动画 */}
      <AnimatePresence initial={false}>
        {mobileNavOpen ? (
          <>
            {/* 背景遮罩：点击遮罩关闭抽屉 */}
            <motion.button
              key="mobile-nav-backdrop"
              type="button"
              className="shell-mobile-nav-backdrop"
              aria-label="Close navigation menu"
              data-route-overlay-ignore
              initial={motionEnabled ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              exit={motionEnabled ? { opacity: 0 } : undefined}
              transition={
                motionEnabled
                  ? { duration: 0.18, ease: [0.22, 1, 0.36, 1] }
                  : undefined
              }
              onClick={() => setMobileNavOpen(false)}
            />

            {/* 抽屉面板：从上方滑入 + 缩小 + 模糊入场 */}
            <motion.div
              key="mobile-nav-panel"
              id="shell-mobile-nav-panel"
              className="shell-mobile-nav-panel"
              data-route-overlay-ignore
              initial={
                motionEnabled
                  ? {
                      opacity: 0,
                      y: -12,
                      scale: 0.985,
                      filter: "blur(10px)",
                    }
                  : false
              }
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
                filter: "blur(0px)",
              }}
              exit={
                motionEnabled
                  ? {
                      opacity: 0,
                      y: -10,
                      scale: 0.988,
                      filter: "blur(8px)",
                    }
                  : undefined
              }
              transition={
                motionEnabled
                  ? {
                      duration: 0.24,
                      ease: [0.22, 1, 0.36, 1],
                    }
                  : undefined
              }
            >
              {/* 抽屉头部：当前页面信息 */}
              <div className="shell-mobile-nav-panel-head">
                <div>
                  <p className="shell-mobile-nav-panel-kicker">Site Menu</p>
                  <p className="shell-mobile-nav-panel-title">
                    {currentItem.label}
                    <span>{currentItem.eyebrow}</span>
                  </p>
                </div>
              </div>

              {/* 导航链接列表 */}
              <nav className="shell-mobile-nav-list">
                {navItems.map((item) => {
                  const Icon = resolveNavIcon(item.icon);
                  const active = isActiveRoute(pathname, item);

                  return (
                    <RouteLink
                      key={item.href}
                      href={item.href}
                      transitionKey={item.transitionKey}
                      className={cn(
                        "shell-mobile-nav-link",
                        active && "shell-mobile-nav-link-active",
                      )}
                      onClick={() => setMobileNavOpen(false)} // 点击导航项后关闭抽屉
                    >
                      <Icon className="relative z-10 h-[18px] w-[18px]" />
                      <span className="relative z-10 flex items-baseline gap-2">
                        <span>{item.label}</span>
                        <span className="font-label text-[10px] uppercase tracking-[0.18em] opacity-80">
                          {item.eyebrow}
                        </span>
                      </span>
                      {active ? (
                        <span
                          className="shell-mobile-nav-pill"
                          aria-hidden="true"
                        />
                      ) : null}
                    </RouteLink>
                  );
                })}
              </nav>

              {/* 底部编辑器入口 */}
              <RouteLink
                href="/editor"
                transitionKey="mobile-nav-editor"
                className="shell-mobile-nav-editor"
                onClick={() => setMobileNavOpen(false)}
              >
                <span className="theme-surface-ghost inline-flex h-8 w-8 items-center justify-center rounded-full">
                  <Settings2 className="h-4 w-4" />
                </span>
                <span>Markdown Editor</span>
              </RouteLink>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
// 第5层：子组件 —— 右下角浮动加号按钮（纯装饰）
// ============================================================
function FloatingAction({ motionEnabled }: { motionEnabled: boolean }) {
  return (
    <motion.div
      className="shell-floating-action"
      initial={motionEnabled ? { opacity: 0, scale: 0.84 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={
        motionEnabled
          ? { duration: 0.42, ease: [0.22, 1, 0.36, 1], delay: 0.16 }
          : undefined
      }
    >
      <Plus className="h-5 w-5" />
    </motion.div>
  );
}

// ============================================================
// 第6层：核心组件 —— AppFrameInner（页面外壳 + 过渡动画编排）
// 这是整个文件最复杂的部分，建议按以下顺序阅读：
//   1. 先看 JSX 骨架（return 部分）
//   2. 再看状态变量
//   3. 最后看 useEffect 逻辑
// ============================================================
function AppFrameInner({ children }: { children: React.ReactNode }) {
  // ---- 路由相关 ----
  const pathname = usePathname();
  const router = useRouter();
  const normalizedPathname = normalizeRoutePathname(pathname);

  // ---- 动画设置 ----
  const prefersReducedMotion = useReducedMotion(); // 用户是否在系统设置了"减少动效"

  // ---- 过渡状态（来自 transition-context.tsx） ----
  const {
    activeTransition,
    phase,
    setPhase,
    finishTransition,
    cancelTransition,
  } = usePageTransition();

  // ---- 组件内部状态 ----
  const [mounted, setMounted] = useState(false); // 是否已挂载（防止 SSR 动画不匹配）
  const [mobileNavOpen, setMobileNavOpen] = useState(false); // 移动端抽屉是否打开
  const [stageReady, setStageReady] = useState(false); // 新页面是否已渲染完成

  // ---- ref（存引用，不触发重渲染） ----
  const stageRef = useRef<HTMLDivElement | null>(null); // 指向页面内容容器
  const settleTimerRef = useRef<number | null>(null); // 过渡结束的定时器
  const stageProbeRef = useRef<number | null>(null); // 轮询检测新页面是否就绪

  // ================================================================
  // 以下是 useEffect 副作用逻辑
  // ================================================================

  // 挂载后标记 mounted，区分"首次渲染"和"客户端交互"
  useEffect(() => {
    setMounted(true);
  }, []);

  // 预取常用路由，让导航更快
  useEffect(() => {
    const routesToWarm = [
      "/",
      "/about",
      "/projects",
      "/resources",
      "/archive",
      "/editor",
      "/posts/building-a-calm-interface",
    ];

    routesToWarm.forEach((href) => {
      void router.prefetch(href);
    });
  }, [router]);

  // 组件卸载时清理定时器和动画帧
  useEffect(() => {
    return () => {
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
      }
      if (stageProbeRef.current !== null) {
        window.cancelAnimationFrame(stageProbeRef.current);
      }
    };
  }, []);

  // 路由切换时自动关闭移动端抽屉
  useEffect(() => {
    setMobileNavOpen(false);
  }, [normalizedPathname]);

  // 窗口宽度 > 900px 时自动关闭移动端抽屉（切回桌面模式）
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 900) {
        setMobileNavOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // 移动端抽屉打开时锁定 body 滚动，防止背景滚动
  useEffect(() => {
    if (!mobileNavOpen) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileNavOpen]);

  // ================================================================
  // 派生状态：根据上面的状态计算出一系列布尔值和动画参数
  // ================================================================

  // 是否允许动画（同时满足"已挂载"和"用户没禁用动效"）
  const motionEnabled = mounted && !prefersReducedMotion;

  // 路由切换动画是否启用（只要已挂载就启用，不受 useReducedMotion 影响）
  const routeMotionEnabled = mounted;

  // 当前过渡中的旧页面快照（用于渲染覆盖层）
  const overlaySnapshot = activeTransition?.snapshot ?? null;
  const overlayVisible = routeMotionEnabled && !!overlaySnapshot;

  // 过渡阶段判断：
  //   waitingForTarget — 新页面还没加载完成（当前路径还是旧页面）
  //   isHoldingTarget  — 新页面已加载但还没就绪（stageReady 为 false）
  const waitingForTarget =
    !!activeTransition && normalizedPathname !== activeTransition.toPathname;
  const isHoldingTarget =
    !!activeTransition &&
    normalizedPathname === activeTransition.toPathname &&
    !stageReady;
  const isTransitionPending = waitingForTarget || isHoldingTarget;

  // 页面容器的最小高度（防止过渡期间布局抖动）
  const transitionStageMinHeight = useMemo(
    () =>
      resolveTransitionStageMinHeight({
        isTransitionActive: !!activeTransition,
        snapshotHeight: activeTransition?.snapshot.height ?? null,
        viewportHeight: mounted ? window.innerHeight : null,
      }),
    [activeTransition, mounted],
  );

  // 新页面内容在"等待中"的动画状态（半透明还是全开）
  const waitingContentMotion = useMemo(
    () => resolveWaitingContentMotion({ isWaitingForTarget: waitingForTarget }),
    [waitingForTarget],
  );

  // 顶部进度条的宽度百分比（模拟浏览器加载进度条）
  const routeProgress = useMemo(() => {
    if (!activeTransition) {
      return "0%"; // 无过渡 → 隐藏
    }

    if (phase === "entering") {
      return "100%"; // 进入阶段 → 加载完成
    }

    return isTransitionPending ? "76%" : "88%"; // 等待中 → 假装加载到 76%
  }, [activeTransition, isTransitionPending, phase]);

  // 如果用户禁用了动效，立即取消当前过渡
  useEffect(() => {
    if (!routeMotionEnabled) {
      if (activeTransition) {
        cancelTransition(activeTransition.id);
      }
      return;
    }
  }, [activeTransition, cancelTransition, routeMotionEnabled]);

  // ================================================================
  // 核心过渡逻辑：轮询检测新页面是否渲染完成
  // 当检测到 ".page-loading-shell" 消失 → 说明新页面就绪
  // 然后触发 "entering" 阶段，播放进入动画
  // ================================================================
  useEffect(() => {
    if (!activeTransition || !stageRef.current) {
      setStageReady(false);
      return;
    }

    if (normalizedPathname !== activeTransition.toPathname) {
      setStageReady(false);
      return;
    }

    const verifyStageReady = () => {
      if (!stageRef.current) {
        return;
      }

      const hasLoadingShell = !!stageRef.current.querySelector(
        ".page-loading-shell",
      );

      // 如果页面还在加载（有 loading-shell），继续轮询
      if (hasLoadingShell) {
        stageProbeRef.current = window.requestAnimationFrame(verifyStageReady);
        return;
      }

      // 页面加载完成 → 标记就绪，进入 entering 阶段
      setStageReady(true);
      setPhase("entering");

      // 清除旧定时器
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
      }

      // 等进入动画播完（680ms），再结束过渡
      settleTimerRef.current = window.setTimeout(() => {
        finishTransition(activeTransition.id);
        settleTimerRef.current = null;
      }, ENTER_SETTLE_MS);
    };

    verifyStageReady();

    // 清理：组件卸载或 activeTransition 变化时取消轮询
    return () => {
      if (stageProbeRef.current !== null) {
        window.cancelAnimationFrame(stageProbeRef.current);
        stageProbeRef.current = null;
      }
    };
  }, [activeTransition, finishTransition, normalizedPathname, setPhase]);

  // ================================================================
  // 第7层：JSX 渲染（先看这里！）
  // 这是整个页面的 HTML 骨架结构
  // ================================================================
  return (
    // LayoutGroup：让所有 layoutId 动画（如导航指示器）在同一个上下文中协调
    <LayoutGroup id="site-shell">
      <div className="site-shell">
        <div className="shell-stage">
          {/* 桌面端侧边导航 */}
          <SideNavigation />

          <div className="shell-content">
            {/* 移动端导航栏 */}
            <MobileNavigation
              motionEnabled={motionEnabled}
              mobileNavOpen={mobileNavOpen}
              setMobileNavOpen={setMobileNavOpen}
            />

            <div className="shell-main-wrap">
              {/* 顶部路由进度条（类似浏览器的加载条） */}
              <div
                className={cn(
                  "shell-route-meter",
                  activeTransition && "shell-route-meter-active",
                )}
                aria-hidden="true"
              >
                <span
                  className="shell-route-meter-fill"
                  style={{ width: routeProgress }}
                />
              </div>

              {/* 页面内容舞台：这里同时渲染"新页面"和"旧页面快照" */}
              <div
                className="shell-main-stage"
                ref={stageRef}
                data-route-stage="main"
                style={{ minHeight: transitionStageMinHeight ?? undefined }}
              >
                {/* ===== 新页面内容 ===== */}
                {/*
                  key={pathname} 是关键：pathname 变化时，
                  framer-motion 认为这是一个"新元素"，触发进出场动画
                */}
                <motion.main
                  key={pathname}
                  className={cn(
                    "shell-main shell-main-layer",
                    overlayVisible && "shell-main-layer-current",
                  )}
                  // 初始状态：透明 + 偏移 + 缩小 + 模糊 + 低饱和度
                  initial={
                    routeMotionEnabled
                      ? {
                          opacity: activeTransition ? 0.24 : 0.4,
                          x: activeTransition ? 42 : 22,
                          y: activeTransition ? 28 : 18,
                          scaleX: activeTransition ? 0.9 : 0.95,
                          scaleY: activeTransition ? 0.84 : 0.94,
                          rotate: activeTransition ? 3.4 : 1.2,
                          filter: activeTransition
                            ? "blur(18px) saturate(0.82)"
                            : "blur(10px) saturate(0.9)",
                        }
                      : false
                  }
                  // 目标状态：由 waitingContentMotion 决定（等待中半透明，就绪后全开）
                  animate={waitingContentMotion}
                  // 弹簧动画参数：stiffness（刚度）、damping（阻尼）、mass（质量）
                  transition={
                    routeMotionEnabled
                      ? {
                          x: {
                            type: "spring",
                            stiffness: 248,
                            damping: 16,
                            mass: 0.78,
                          },
                          y: {
                            type: "spring",
                            stiffness: 228,
                            damping: 16,
                            mass: 0.8,
                          },
                          scaleX: {
                            type: "spring",
                            stiffness: 280,
                            damping: 13,
                            mass: 0.7,
                          },
                          scaleY: {
                            type: "spring",
                            stiffness: 262,
                            damping: 12,
                            mass: 0.68,
                          },
                          rotate: {
                            type: "spring",
                            stiffness: 220,
                            damping: 16,
                            mass: 0.8,
                          },
                          opacity: { duration: 0.26, ease: [0.22, 1, 0.36, 1] },
                          filter: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
                        }
                      : undefined
                  }
                >
                  {children}
                </motion.main>

                {/* ===== 旧页面快照覆盖层 ===== */}
                {/*
                  在过渡期间，旧页面不会直接消失，而是以 DOM 快照的形式
                  覆盖在新页面之上，然后慢慢淡出，防止白屏
                */}
                {overlaySnapshot ? (
                  <motion.div
                    key={`${activeTransition?.fromPathname ?? normalizedPathname}-${activeTransition?.id ?? 0}`}
                    className={cn(
                      "shell-main shell-main-layer shell-main-layer-overlay",
                      phase === "exiting" && "shell-main-layer-overlay-holding",
                    )}
                    data-route-overlay-ignore
                    style={{
                      width: overlaySnapshot.width,
                      minHeight: overlaySnapshot.height,
                    }}
                    // 初始：完全可见
                    initial={{
                      opacity: 1,
                      x: 0,
                      y: 0,
                      scaleX: 1,
                      scaleY: 1,
                      rotate: 0,
                      filter: "blur(0px) saturate(1)",
                    }}
                    // 目标：进入时向左上角缩小淡出，还在等待时轻微偏移
                    animate={
                      phase === "entering"
                        ? {
                            opacity: 0,
                            x: -96,
                            y: -40,
                            scaleX: 0.84,
                            scaleY: 0.74,
                            rotate: -5.8,
                            filter: "blur(20px) saturate(0.84)",
                          }
                        : {
                            opacity: 1,
                            x: -18,
                            y: -14,
                            scaleX: 0.978,
                            scaleY: 0.948,
                            rotate: -1.1,
                            filter: "blur(3px) saturate(0.98)",
                          }
                    }
                    transition={
                      phase === "entering"
                        ? {
                            x: {
                              type: "spring",
                              stiffness: 176,
                              damping: 14,
                              mass: 0.92,
                            },
                            y: {
                              type: "spring",
                              stiffness: 166,
                              damping: 13,
                              mass: 0.94,
                            },
                            scaleX: {
                              type: "spring",
                              stiffness: 244,
                              damping: 12,
                              mass: 0.58,
                            },
                            scaleY: {
                              type: "spring",
                              stiffness: 226,
                              damping: 11,
                              mass: 0.56,
                            },
                            rotate: {
                              type: "spring",
                              stiffness: 196,
                              damping: 13,
                              mass: 0.8,
                            },
                            opacity: {
                              duration: 0.26,
                              ease: [0.18, 0.88, 0.18, 1],
                            },
                            filter: {
                              duration: 0.3,
                              ease: [0.18, 0.88, 0.18, 1],
                            },
                          }
                        : {
                            x: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
                            y: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
                            scaleX: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
                            scaleY: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
                            rotate: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
                            opacity: {
                              duration: 0.2,
                              ease: [0.22, 1, 0.36, 1],
                            },
                            filter: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
                          }
                    }
                  >
                    {/* 覆盖层上的光泽效果（装饰） */}
                    <div
                      className="shell-main-overlay-sheen"
                      aria-hidden="true"
                    />
                    {/* 旧页面的 HTML 快照 */}
                    <div
                      className="shell-main-overlay-html"
                      dangerouslySetInnerHTML={{ __html: overlaySnapshot.html }}
                    />
                  </motion.div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* 底部主题切换按钮 */}
        <div className="shell-theme-dock" data-route-overlay-ignore>
          <ThemeToggleButton />
        </div>

        {/* 浮动加号按钮 */}
        <FloatingAction motionEnabled={motionEnabled} />
      </div>
    </LayoutGroup>
  );
}

// ============================================================
// 第8层：导出组件 —— AppFrame（最外层的包装）
// 用法：在 layout.tsx 中 <AppFrame>{children}</AppFrame>
// ============================================================
export function AppFrame({ children }: { children: React.ReactNode }) {
  return (
    // PageTransitionProvider 提供过渡状态上下文
    <PageTransitionProvider>
      <AppFrameInner>{children}</AppFrameInner>
    </PageTransitionProvider>
  );
}
