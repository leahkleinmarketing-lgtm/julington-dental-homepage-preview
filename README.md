# Julington Dental homepage concept

Static, responsive homepage concept prepared by Klein Marketing. The existing Julington Dental website is untouched.

## Run locally

From this folder, run:

```powershell
node server.mjs
```

Open `http://localhost:4173`. The page has no build step or runtime dependencies.

## Assets and sources

- `assets/` holds the originals from the supplied build kit and reference screenshots. The source ZIP is in the parent `assets/` folder.
- `julington-logo.png` and `practice.jpg` originated from [Julington Dental](https://julingtondental.com/).
- The three `testimonial-*.png` video thumbnails and `julington-map.png` were supplied with the mockup. Review cards retain excerpts with first name and last initial; the original review screenshots are not stored in this repository.
- `cleaning.png`, `implants.png`, `crowns.png`, `aligners.png`, and `dentures.png` are supplied AI-generated concept imagery. Their visually matched JPEG copies in `dist/assets/` are compressed at quality 88 for delivery.
- Review card excerpts use words visible in the supplied Google review screenshots. Search results did not independently confirm that the reviews remain published. Recheck Google and get Julington Dental's approval before an official public launch.
- The patient video URLs and service links were cross-checked against Julington Dental's [testimonials](https://julingtondental.com/testimonials/) and [services](https://julingtondental.com/services/) pages. The directions link is the Google Maps URL linked from Julington Dental's official footer.

## Launch notes

The visible concept label must remain until Julington Dental approves a production launch. The cleaning and four service images are illustrative; Julington Dental should approve them before official use. Appointment buttons point to the [official contact page](https://julingtondental.com/contact/).

The GitHub Pages workflow publishes `dist/` when `main` is pushed. In repository **Settings → Pages**, select **GitHub Actions** as the source if Pages is not already configured.

GitHub Pages preview: https://leahkleinmarketing-lgtm.github.io/julington-dental-homepage-preview/
