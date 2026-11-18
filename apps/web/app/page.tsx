import Link from "next/link";
import { Camera, Package, TrendingUp } from "lucide-react";
import { BrandMark } from "../components/brand/brand-mark";
import { actionClass } from "../components/ui/button";
import { LanguagePicker } from "../features/language/language-picker";
import { messages } from "../features/language/messages";
import { currentLocale } from "../features/language/preference";

export default async function Home() {
  const locale = await currentLocale();
  const copy = messages[locale];
  const az = locale === "az";
  const features = [
    {
      Icon: Package,
      title: az ? "Məhsul və anbar" : "Products and inventory",
      text: az
        ? "Əyarı, çəkini və anbardakı qalığı izləyin."
        : "Track purity, weight, and stock availability.",
    },
    {
      Icon: Camera,
      title: az ? "Məhsul fotoları" : "Product photos",
      text: az
        ? "Məhsula foto əlavə edin və kodla tapın."
        : "Add a photo and find each piece by its code.",
    },
    {
      Icon: TrendingUp,
      title: az ? "Satış və hesablaşma" : "Sales and settlement",
      text: az
        ? "Satışı və köhnə qızıl qəbulunu qeydə alın."
        : "Record sales and old-gold trade-ins.",
    },
  ];
  return (
    <main className="mx-auto box-border min-h-dvh max-w-[1202px] px-4 pt-2.5 pb-10">
      <header className="mizan-header box-border flex min-h-17 flex-wrap items-center justify-between gap-3 rounded-[19px] px-4 py-2">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-bold text-mizan-ink no-underline focus-visible:outline-2 focus-visible:outline-mizan-focus"
        >
          <BrandMark variant="light" />
          Mizan
        </Link>
        <LanguagePicker locale={locale} compact />
      </header>
      <section className="mizan-landing-hero mt-8 flex min-w-0 flex-col items-start gap-8 rounded-[28px] border border-mizan-accent bg-mizan-hero p-6 text-mizan-pale sm:p-10 min-[1000px]:flex-row min-[1000px]:items-center min-[1000px]:gap-12 min-[1000px]:p-18">
        <div className="min-w-0 flex-1">
          <p className="m-0 mb-2 text-[13px] font-bold text-mizan-dark-muted">
            {az ? "Zərgərlik mağazaları üçün" : "For jewelry stores"}
          </p>
          <h1 className="m-0 max-w-175 text-[clamp(36px,5vw,73px)] leading-[1.03] font-bold tracking-[-0.06em]">
            {az ? (
              <>
                Mağazanızın işi bir
                <br className="hidden sm:block" /> yerdə.
              </>
            ) : (
              "Your store, in one place."
            )}
          </h1>
          <p className="m-0 mt-2 max-w-110 text-[17px] leading-relaxed text-mizan-dark-muted">
            {az
              ? "Məhsulları, satışları və anbarı bir paneldən idarə edin."
              : "Manage products, sales, and inventory from one workspace."}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href="/register"
              className={
                actionClass +
                " bg-mizan-inverse text-mizan-primary hover:bg-mizan-inverse-hover"
              }
            >
              {copy.signUp}
            </Link>
            <Link
              href="/sign-in"
              className={
                actionClass +
                " border-mizan-pale/30 bg-mizan-pale/10 text-mizan-pale hover:bg-mizan-pale/20"
              }
            >
              {copy.signIn}
            </Link>
          </div>
        </div>
        <div aria-hidden className="hidden sm:block">
          <BrandMark size="hero" />
        </div>
      </section>
      <ul className="m-0 mt-3 grid list-none gap-3 p-0 sm:grid-cols-3">
        {features.map(({ Icon, title, text }) => (
          <li
            key={title}
            className="mizan-glass-light flex min-w-0 items-center gap-3 rounded-2xl p-3"
          >
            <Icon
              size={22}
              aria-hidden
              className="shrink-0 text-mizan-accent"
            />
            <div className="min-w-0">
              <h2 className="m-0 text-[13px] font-bold">{title}</h2>
              <p className="m-0 mt-0.5 text-xs text-mizan-muted">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
