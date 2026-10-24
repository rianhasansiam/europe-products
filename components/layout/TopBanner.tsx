import { getActiveTopBanners } from "@/lib/services/banner.service";

import TopBannerClient, {
  type TopBannerSlide,
} from "./TopBannerClient";

/**
 * Site-wide promotional strip. Server component: it reads the active
 * TOP banners (managed from the admin "Banners" page, stored in the
 * unified `Banner` model) and hands them to the client renderer that
 * owns the rotation / dismiss interactions.
 *
 * When no active TOP banner exists the client renders nothing, so the
 * strip simply disappears instead of showing placeholder copy.
 */
const TopBanner = async () => {
  const banners = await getActiveTopBanners();

  const slides: TopBannerSlide[] = banners.map((banner) => ({
    id: banner.id,
    icon: banner.icon,
    badge: banner.badge,
    discount: banner.discount,
    description: banner.description,
    tag: banner.tag,
    tagIcon: banner.tagIcon,
    link: banner.link,
  }));

  if (slides.length === 0) return null;

  return <TopBannerClient slides={slides} />;
};

export default TopBanner;
