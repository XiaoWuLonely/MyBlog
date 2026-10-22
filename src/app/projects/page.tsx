import type { Metadata } from "next";
import { connection } from "next/server";
import Image from "next/image";
import { Boxes, Grid2x2, Sparkles, SquareStack } from "lucide-react";
import { Suspense } from "react";
import { Reveal } from "@/components/motion/reveal";
import { AdminDeleteButton } from "@/components/site/admin-delete-button";
import { RouteLink } from "@/components/site/route-link";
import { GlassPanel, Pill } from "@/components/site/ui";
import { isAdminRequest } from "@/lib/admin-auth-server";
import { getCachedAllProjects } from "@/lib/cached-content";
import { buildEditorLoadHref } from "@/lib/editor";

export const metadata: Metadata = {
  title: "项目",
  description: "精选项目与界面实验的集中展示页。",
};

function accentClasses(accent: "primary" | "secondary" | "tertiary") {
  if (accent === "secondary") {
    return "bg-secondary-soft text-secondary";
  }

  if (accent === "tertiary") {
    return "bg-[rgba(255,217,125,0.24)] text-tertiary";
  }

  return "bg-primary-soft text-primary";
}

function projectIcon(icon: "grid" | "spark" | "pen" | "layers") {
  switch (icon) {
    case "spark":
      return Sparkles;
    case "pen":
      return SquareStack;
    case "layers":
      return Boxes;
    case "grid":
    default:
      return Grid2x2;
  }
}

// 管理员的编辑/删除入口需要读 cookies，放入 Suspense 动态洞以保持列表页外壳可缓存。
async function ProjectCardAdminActions({ slug }: { slug: string }) {
  if (!(await isAdminRequest())) {
    return null;
  }

  return (
    <>
      <RouteLink
        href={buildEditorLoadHref("project", slug)}
        className="theme-surface inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-primary"
      >
        编辑
      </RouteLink>
      <AdminDeleteButton category="project" slug={slug} variant="inline">
        删除
      </AdminDeleteButton>
    </>
  );
}

export default async function ProjectsPage() {
  // 内容只存在云端 D1，构建期 worker 拿不到 binding，预渲染会固化成空列表；
  // 用 connection() 把这一页推迟到请求期渲染（数据本身仍由 use cache 缓存 5 分钟）。
  await connection();
  const projects = await getCachedAllProjects();

  return (
    <div className="space-y-6 pb-8 pt-2">
      <Reveal>
        <section className="space-y-3">
          <Pill active className="w-fit">
            Selected Works
          </Pill>
          <h1 className="font-heading text-5xl font-black tracking-[-0.08em] text-foreground md:text-6xl">
            项目作品集<span className="text-primary italic">.</span>
          </h1>
          <p className="max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
            暮色与玻璃气质下的长期产品判断、前端实现与内容组织实验。
          </p>
        </section>
      </Reveal>

      <section className="editorial-grid md:grid-cols-2">
        {projects.map((project, index) => {
          const Icon = projectIcon(project.icon);

          return (
            <Reveal key={project.slug} delay={0.05 * (index + 1)}>
              <GlassPanel className="group flex h-full flex-col justify-between p-6 transition hover:-translate-y-1">
                <RouteLink
                  href={`/projects/${project.slug}`}
                  transitionKey={`project-${project.slug}`}
                  className="block"
                >
                  <div className="space-y-5">
                    <div className="flex items-start justify-between gap-4">
                      {project.cover ? (
                        <div className="theme-surface h-24 w-36 overflow-hidden rounded-[24px]">
                          <Image
                            src={project.cover}
                            alt={project.title}
                            width={720}
                            height={480}
                            className="h-full w-full object-cover"
                            sizes="288px"
                          />
                        </div>
                      ) : (
                        <div
                          className={`inline-flex h-12 w-12 items-center justify-center rounded-[18px] ${accentClasses(project.accent)}`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                      )}
                      <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        {project.year}
                      </span>
                    </div>

                    <div>
                      <h2 className="font-heading text-2xl font-black tracking-[-0.05em] text-foreground transition group-hover:text-primary">
                        {project.title}
                      </h2>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {project.stack.map((item) => (
                          <Pill key={item}>{item}</Pill>
                        ))}
                      </div>
                      <p className="mt-4 text-sm leading-7 text-muted-foreground">
                        {project.summary}
                      </p>
                    </div>
                  </div>
                </RouteLink>

                <div className="mt-6 flex flex-wrap gap-3">
                  <RouteLink
                    href={`/projects/${project.slug}`}
                    transitionKey={`project-${project.slug}`}
                    className="theme-surface inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-foreground"
                  >
                    预览
                  </RouteLink>
                  <Suspense fallback={null}>
                    <ProjectCardAdminActions slug={project.slug} />
                  </Suspense>
                </div>
              </GlassPanel>
            </Reveal>
          );
        })}
      </section>
    </div>
  );
}
