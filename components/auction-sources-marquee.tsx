import Image from "next/image";

type AuctionSource = {
  name: string;
  logo: string;
  alt: string;
  imageClassName?: string;
};

const auctionSources: AuctionSource[] = [
  {
    name: "Copart",
    logo: "/logos/auction-sources/copart.png",
    alt: "Logo Copart",
    imageClassName: "max-h-32 scale-[3.2] md:max-h-44 md:scale-[3.6]"
  },
  {
    name: "Freitas Leiloeiro",
    logo: "/logos/auction-sources/freitas.png",
    alt: "Logo Freitas Leiloeiro",
    imageClassName: "max-h-32 scale-[3.1] md:max-h-44 md:scale-[3.6]"
  },
  {
    name: "Sodre Santoro",
    logo: "/logos/auction-sources/sodre-santoro.png",
    alt: "Logo Sodré Santoro",
    imageClassName: "max-h-32 scale-[3.0] md:max-h-44 md:scale-[3.4]"
  }
];

const marqueeSources = [...auctionSources, ...auctionSources, ...auctionSources, ...auctionSources];

export function AuctionSourcesMarquee() {
  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-border/80 bg-white/86 py-10 shadow-panel">
      <div className="mx-auto flex max-w-4xl flex-col items-center px-5 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-accent">Leiloeiros integrados</p>
        <h2 className="mt-2 font-display text-4xl font-extrabold text-primary md:text-5xl">Fontes conectadas ao LanceCerto</h2>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted">Importe lotes da Copart, Freitas Leiloeiro e Sodré Santoro em um só lugar.</p>
        <span className="mx-auto mt-5 block h-1 w-16 rounded-full bg-accent" />
      </div>

      <div className="auction-sources-marquee group mt-7">
        <div className="auction-sources-marquee__track">
          {marqueeSources.map((source, index) => (
            <div key={`${source.name}-${index}`} className="flex h-40 w-[20rem] shrink-0 items-center justify-center bg-transparent px-4 md:h-52 md:w-[28rem]">
              <Image
                src={source.logo}
                alt={source.alt}
                width={520}
                height={220}
                className={[
                  "h-auto w-auto max-w-[420px] object-contain opacity-100 transition duration-300 md:max-w-[560px]",
                  source.imageClassName ?? ""
                ].join(" ")}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
