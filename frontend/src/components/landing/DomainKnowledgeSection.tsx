import React from 'react';

const organisations = [
  { name: 'Houses of the Oireachtas', src: '/sponsors/oireachtas.png' },
  { name: 'Iowa', src: '/sponsors/iowa.svg' },
  { name: 'Kansas', src: '/sponsors/kansas.svg' },
  { name: 'KPMG', src: '/sponsors/kpmg.png' },
  { name: 'LexisNexis', src: '/sponsors/lexis_nexis.svg' },
  { name: 'North Dakota', src: '/sponsors/north_dakota.svg' },
  { name: 'Northern Ireland Assembly', src: '/sponsors/nireland.svg' },
  { name: 'Pennsylvania', src: '/sponsors/pennsylvania.svg' },
  { name: 'South Carolina', src: '/sponsors/scarolina.svg' },
  { name: 'Welsh Government', src: '/sponsors/Welsh_Government.png' },
];

export const DomainKnowledgeSection: React.FC = () => {
  const [failedLogos, setFailedLogos] = React.useState<Record<string, boolean>>({});

  return (
    <section className="py-16 px-10 bg-slate-100">
      <div className="max-w-[1320px] mx-auto">
        <h2
          className="text-center text-[46px] leading-[1.15] tracking-[-0.02em] text-slate-900 mb-3"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Deep domain knowledge
        </h2>
        <p className="text-center text-[22px] text-slate-700 mb-10">
          We have brought value to rule-makers and rule-takers globally
        </p>

        <div className="relative overflow-hidden">
          <div className="sponsors-marquee-track flex items-center gap-5 w-max">
            {[...organisations, ...organisations].map((organisation, index) => (
              <div
                key={`${organisation.name}-${index}`}
                className="w-[210px] h-[112px] flex items-center justify-center px-4 shrink-0"
                aria-label={organisation.name}
              >
                {!failedLogos[organisation.src] ? (
                  <img
                    src={organisation.src}
                    alt={organisation.name}
                    className="max-h-[72px] max-w-[170px] w-auto h-auto object-contain"
                    loading="lazy"
                    onError={() =>
                      setFailedLogos((prev) => ({
                        ...prev,
                        [organisation.src]: true,
                      }))
                    }
                  />
                ) : (
                  <span
                    className="text-slate-900 text-center text-[16px] font-semibold leading-tight"
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    {organisation.name}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
