import Image from "next/image";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Mail, MapPin, Milestone, Sparkles } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { ActionLink, GlassPanel, Pill, SoftPanel } from "@/components/site/ui";
import { aboutHighlights, aboutSkills, siteConfig, socialLinks, timeline } from "@/content/site";
import { getCachedAllProjects } from "@/lib/cached-content";
import { MessageForm } from "./message-form";

export const metadata: Metadata = {
  title: "关于",
  description: "关于 WuLong 的学习记录、开发实践与个人博客。",
};

export default async function AboutPage() {
  // 近期项目来自云端 D1，构建期读不到，推迟到请求期渲染。
  await connection();
  const projects = await getCachedAllProjects();

  return (
    <div className="space-y-6 pb-8 pt-2">
      <Reveal>
        <section className="about-hero-grid">
          <GlassPanel className="about-hero-copy relative overflow-hidden p-6 sm:p-8">
            <div className="absolute bottom-0 right-0 text-[8rem] scrap-icon">
              <Sparkles className="h-28 w-28 fill-current" />
            </div>

            <div className="space-y-5">
              <Pill active className="w-fit">
                Student & Developer
              </Pill>
              <h1 className="font-heading text-5xl font-black tracking-[-0.08em] text-foreground md:text-6xl">
                关于 / <span className="text-primary italic">About Me</span>
              </h1>
              <p className="max-w-2xl text-sm leading-8 text-muted-foreground md:text-base">
                这里记录我的学习笔记、前端实践、项目整理和日常思考。希望这个博客可以长期更新，也能把零散的知识和经验沉淀成清晰的内容。
              </p>
              <div className="flex flex-wrap gap-3">
                <ActionLink href="/archive" transitionKey="about-archive">
                  探索文章
                </ActionLink>
                <ActionLink href="/projects" variant="secondary" transitionKey="about-projects">
                  查看作品
                </ActionLink>
              </div>
            </div>
          </GlassPanel>

          <GlassPanel className="about-hero-image-wrap p-4">
            <div className="about-hero-image-stack">
              <div className="about-hero-image-shadow" aria-hidden="true" />
              <Image
                src={siteConfig.gallery[1]}
                alt="About page editorial board"
                width={720}
                height={900}
                className="about-hero-image"
              />
            </div>
          </GlassPanel>
        </section>
      </Reveal>

      <section className="about-body-grid">
        <Reveal delay={0.04}>
          <aside className="about-rail">
            <GlassPanel className="about-profile-card p-6">
              <div className="relative h-24 w-24">
                <div className="overflow-hidden rounded-full border-4 border-white shadow-[var(--shadow-mid)]">
                  <Image
                    src={siteConfig.avatar}
                    alt="WuLong avatar"
                    width={240}
                    height={240}
                    className="h-full w-full object-cover"
                  />
                </div>
                <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-white bg-green-500" />
              </div>

              <div className="space-y-2">
                <h2 className="font-heading text-3xl font-black tracking-[-0.05em] text-foreground">WuLong</h2>
                <p className="text-xs tracking-[0.2em] text-muted-foreground">学生 / 开发者</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Pill active>学生</Pill>
                <Pill>开发者</Pill>
                <Pill>博客作者</Pill>
              </div>

              <div className="about-rail-copy">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Current Status</p>
                <p className="mt-3 text-sm leading-7 text-foreground">
                  正在持续整理前端学习记录、个人项目和技术资源，让这个博客成为稳定更新的学习空间。
                </p>
              </div>
            </GlassPanel>

            <GlassPanel className="p-5">
              <h3 className="font-heading text-sm font-black uppercase tracking-[0.18em] text-foreground">Social</h3>
              <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                <div className="inline-flex items-center gap-3">
                  <Mail className="h-4 w-4 text-primary" />
                  {siteConfig.email}
                </div>
                <div className="inline-flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-primary" />
                  {siteConfig.location}
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {socialLinks.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    className="theme-surface rounded-full px-4 py-2 text-sm transition hover:text-primary"
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </GlassPanel>

            <GlassPanel className="p-5">
              <h3 className="font-heading text-sm font-black uppercase tracking-[0.18em] text-foreground">
                核心技能 / Skills
              </h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {aboutSkills.map((item) => (
                  <Pill key={item}>{item}</Pill>
                ))}
              </div>
              <SoftPanel className="mt-5 p-4 text-sm italic leading-7 text-primary">
                “把学习过程记录下来，也是在给未来的自己留下路线。”
              </SoftPanel>
            </GlassPanel>
          </aside>
        </Reveal>

        <div className="grid gap-6">
          <Reveal delay={0.08}>
            <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
              <GlassPanel className="p-6 sm:p-8">
                <h2 className="font-heading text-2xl font-black tracking-[-0.05em] text-foreground">自我介绍</h2>
                <div className="mt-5 space-y-3">
                  {aboutHighlights.map((item) => (
                    <SoftPanel key={item} className="p-4 text-sm leading-7 text-muted-foreground">
                      {item}
                    </SoftPanel>
                  ))}
                </div>
              </GlassPanel>

              <GlassPanel className="p-6">
                <div className="flex items-center gap-2">
                  <Milestone className="h-4 w-4 text-primary" />
                  <h3 className="font-heading text-lg font-black tracking-[-0.04em] text-foreground">
                    历程 / Timeline
                  </h3>
                </div>
                <div className="mt-5 space-y-5">
                  {timeline.map((item) => (
                    <div key={item.year} className="relative pl-5">
                      <span className="absolute left-0 top-2 h-2.5 w-2.5 rounded-full bg-primary" />
                      <p className="text-[10px] uppercase tracking-[0.2em] text-primary">{item.year}</p>
                      <h4 className="mt-1 font-heading text-base font-black tracking-[-0.03em] text-foreground">
                        {item.title}
                      </h4>
                      <p className="mt-1 text-sm leading-7 text-muted-foreground">{item.description}</p>
                    </div>
                  ))}
                </div>
              </GlassPanel>
            </section>
          </Reveal>

          <Reveal delay={0.12}>
            <section className="grid gap-6 xl:grid-cols-[1.04fr_0.96fr]">
              <GlassPanel className="p-6 sm:p-8">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-heading text-2xl font-black tracking-[-0.05em] text-foreground">近期项目</h3>
                  <Pill active>Selected Work</Pill>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {projects.slice(0, 2).map((project) => (
                    <SoftPanel key={project.slug} className="p-4">
                      <Pill active>{project.year}</Pill>
                      <h4 className="mt-3 font-heading text-xl font-black tracking-[-0.04em] text-foreground">
                        {project.title}
                      </h4>
                      <p className="mt-2 text-sm leading-7 text-muted-foreground">{project.summary}</p>
                    </SoftPanel>
                  ))}
                </div>
              </GlassPanel>

              <GlassPanel className="p-4">
                <div className="grid h-full gap-3 sm:grid-cols-3">
                  {siteConfig.gallery.map((image, index) => (
                    <div key={image} className={index === 0 ? "sm:col-span-2" : ""}>
                      <Image
                        src={image}
                        alt={`Gallery ${index + 1}`}
                        width={900}
                        height={900}
                        className="aspect-[4/3] h-full w-full rounded-[22px] object-cover"
                      />
                    </div>
                  ))}
                </div>
              </GlassPanel>
            </section>
          </Reveal>

          <Reveal delay={0.16}>
            <GlassPanel className="p-6 sm:p-8">
              <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr] xl:items-start">
                <div className="space-y-3">
                  <h3 className="font-heading text-2xl font-black tracking-[-0.05em] text-foreground">
                    留言 / Message
                  </h3>
                  <p className="text-sm leading-7 text-muted-foreground">
                    如果你也在学习前端、整理个人项目，或想交流技术博客和开发实践，可以来聊。这里保留了一块轻量的联系区域，留言只用于后台管理。
                  </p>
                </div>

                <MessageForm />
              </div>
            </GlassPanel>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
