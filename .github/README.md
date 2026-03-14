# GitHub Configuration

## Social Preview Image

To set the social preview image for this repository:

1. Go to your repository settings on GitHub
2. Navigate to **Settings** → **General** → **Social preview**
3. Click **Edit** and upload `social-preview.svg` (or convert it to PNG first)

### Converting SVG to PNG

If GitHub requires PNG format, you can convert using:

```bash
# Using ImageMagick
convert -density 300 -background none .github/social-preview.svg -resize 1280x640 .github/social-preview.png

# Using Inkscape
inkscape .github/social-preview.svg --export-type=png --export-filename=.github/social-preview.png -w 1280 -h 640

# Using a browser (quick method)
# Open social-preview.svg in Chrome/Firefox, take a screenshot, crop to 1280x640
```

Alternatively, use an online converter like [CloudConvert](https://cloudconvert.com/svg-to-png).

## Recommended Image Size

- **Optimal:** 1280 × 640 pixels (2:1 ratio)
- **Format:** PNG or JPG
- **Max file size:** 1 MB

This social preview will appear when your repository is shared on:
- Twitter/X
- LinkedIn
- Slack
- Discord
- And other social platforms supporting Open Graph
