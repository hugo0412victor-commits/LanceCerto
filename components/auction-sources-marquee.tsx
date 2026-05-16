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
    imageClassName: "scale-[1.25] md:scale-[1.35]"
  },
  {
    name: "Freitas Leiloeiro",
    logo: "/logos/auction-sources/freitas.png",
    alt: "Logo Freitas Leiloeiro",
    imageClassName: "scale-[1.2] md:scale-[1.32]"
  },
  {
    name: "Sodre Santoro",
    logo: "/logos/auction-sources/sodre-santoro.png",
    alt: "Logo Sodré Santoro",
    imageClassName: "scale-[1.2] md:scale-[1.3]"
  }
];

const marqueeSources = [...auctionSources, ...auctionSources, ...auctionSources, ...auctionSources];

export function AuctionSourcesMarquee() {
  return (
    <section className="overflow-hidden rounded-[1.35rem] border border-border/80 bg-white/86 py-4 shadow-panel">
      <div className="mx-auto flex max-w-3xl flex-col items-center px-4 text-center">
        <p className="text-[0.62rem] font-bold uppercase tracking-[0.24em] text-accent">Leiloeiros integrados</p>
        <h2 className="mt-1 font-display text-2xl font-extrabold text-primary md:text-3xl">Fontes conectadas ao LanceCerto</h2>
        <p className="mt-1.5 max-w-xl text-xs leading-5 text-muted md:text-sm">Importe lotes da Copart, Freitas Leiloeiro e Sodré Santoro em um só lugar.</p>
        <span className="mx-auto mt-3 block h-0.5 w-12 rounded-full bg-accent" />
      </div>

      <div className="auction-sources-marquee group mt-3">
        <div className="auction-sources-marquee__track">
          {marqueeSources.map((source, index) => (
            <div key={`${source.name}-${index}`} className="flex h-16 w-44 shrink-0 items-center justify-center bg-transparent px-2 md:h-20 md:w-52">
              <Image
                src={source.logo}
                alt={source.alt}
                width={240}
                height={100}
                className={[
                  "h-auto w-auto max-w-[160px] object-contain opacity-100 transition duration-300 md:max-w-[190px]",
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
