import type { EnrichedGym } from "@/lib/types/scout";

/** schema.org ExerciseGym structured data — search + AI answer engines.
 *  Payload is built ONLY from our own typed fields; "<" is escaped to
 *  < so scraped description text can never break out of the tag. */
export function GymJsonLd({ gym }: { gym: EnrichedGym }) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "ExerciseGym",
    name: gym.name,
    url: `https://scout-gym.netlify.app/gym/${gym.slug}`,
    ...(gym.description ? { description: gym.description } : {}),
    ...(gym.photo_url ? { image: gym.photo_url } : {}),
    ...(gym.phone ? { telephone: gym.phone } : {}),
    ...(gym.website ? { sameAs: gym.website } : {}),
    ...(gym.address
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: gym.address,
            addressLocality: "Tampa",
            addressRegion: "FL",
            addressCountry: "US",
          },
        }
      : {}),
    ...(gym.lat !== null && gym.lng !== null
      ? { geo: { "@type": "GeoCoordinates", latitude: gym.lat, longitude: gym.lng } }
      : {}),
    ...(gym.day_pass_price !== null
      ? {
          offers: {
            "@type": "Offer",
            name: "Day pass",
            price: Number(gym.day_pass_price).toFixed(2),
            priceCurrency: "USD",
          },
        }
      : {}),
    ...(gym.rating !== null && gym.rating_count > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: Number(gym.rating).toFixed(1),
            reviewCount: gym.rating_count,
          },
        }
      : {}),
    ...(gym.amenities.some((a) => a.present)
      ? {
          amenityFeature: gym.amenities
            .filter((a) => a.present)
            .slice(0, 12)
            .map((a) => ({
              "@type": "LocationFeatureSpecification",
              name: a.amenity_key.replace(/_/g, " "),
              value: true,
            })),
        }
      : {}),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
