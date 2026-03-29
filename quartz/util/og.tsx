import { promises as fs } from "fs"
import { FontWeight, SatoriOptions } from "satori/wasm"
import { GlobalConfiguration } from "../cfg"
import { QuartzPluginData } from "../plugins/vfile"
import { JSXInternal } from "preact/src/jsx"
import { FontSpecification, getFontSpecificationName, ThemeKey } from "./theme"
import path from "path"
import { QUARTZ } from "./path"
import { formatDate, getDate } from "../components/Date"
import readingTime from "reading-time"
import { i18n } from "../i18n"
import { styleText } from "util"

const defaultHeaderWeight = [700]
const defaultBodyWeight = [400]

export async function getSatoriFonts(headerFont: FontSpecification, bodyFont: FontSpecification) {
  // Get all weights for header and body fonts
  const headerWeights: FontWeight[] = (
    typeof headerFont === "string"
      ? defaultHeaderWeight
      : (headerFont.weights ?? defaultHeaderWeight)
  ) as FontWeight[]
  const bodyWeights: FontWeight[] = (
    typeof bodyFont === "string" ? defaultBodyWeight : (bodyFont.weights ?? defaultBodyWeight)
  ) as FontWeight[]

  const headerFontName = typeof headerFont === "string" ? headerFont : headerFont.name
  const bodyFontName = typeof bodyFont === "string" ? bodyFont : bodyFont.name

  // Fetch fonts for all weights and convert to satori format in one go
  const headerFontPromises = headerWeights.map(async (weight) => {
    const data = await fetchTtf(headerFontName, weight)
    if (!data) return null
    return {
      name: headerFontName,
      data,
      weight,
      style: "normal" as const,
    }
  })

  const bodyFontPromises = bodyWeights.map(async (weight) => {
    const data = await fetchTtf(bodyFontName, weight)
    if (!data) return null
    return {
      name: bodyFontName,
      data,
      weight,
      style: "normal" as const,
    }
  })

  const [headerFonts, bodyFonts] = await Promise.all([
    Promise.all(headerFontPromises),
    Promise.all(bodyFontPromises),
  ])

  // Filter out any failed fetches and combine header and body fonts
  const fonts: SatoriOptions["fonts"] = [
    ...headerFonts.filter((font): font is NonNullable<typeof font> => font !== null),
    ...bodyFonts.filter((font): font is NonNullable<typeof font> => font !== null),
  ]

  return fonts
}

/**
 * Get the `.ttf` file of a google font
 * @param fontName name of google font
 * @param weight what font weight to fetch font
 * @returns `.ttf` file of google font
 */
export async function fetchTtf(
  rawFontName: string,
  weight: FontWeight,
): Promise<Buffer<ArrayBufferLike> | undefined> {
  const fontName = rawFontName.replaceAll(" ", "+")
  const cacheKey = `${fontName}-${weight}`
  const cacheDir = path.join(QUARTZ, ".quartz-cache", "fonts")
  const cachePath = path.join(cacheDir, cacheKey)

  // Check if font exists in cache
  try {
    await fs.access(cachePath)
    return fs.readFile(cachePath)
  } catch (error) {
    // ignore errors and fetch font
  }

  // Get css file from google fonts
  const cssResponse = await fetch(
    `https://fonts.googleapis.com/css2?family=${fontName}:wght@${weight}`,
  )
  const css = await cssResponse.text()

  // Extract .ttf url from css file
  const urlRegex = /url\((https:\/\/fonts.gstatic.com\/s\/.*?.ttf)\)/g
  const match = urlRegex.exec(css)

  if (!match) {
    console.log(
      styleText(
        "yellow",
        `\nWarning: Failed to fetch font ${rawFontName} with weight ${weight}, got ${cssResponse.statusText}`,
      ),
    )
    return
  }

  // fontData is an ArrayBuffer containing the .ttf file data
  const fontResponse = await fetch(match[1])
  const fontData = Buffer.from(await fontResponse.arrayBuffer())
  await fs.mkdir(cacheDir, { recursive: true })
  await fs.writeFile(cachePath, fontData)

  return fontData
}

export type SocialImageOptions = {
  /**
   * What color scheme to use for image generation (uses colors from config theme)
   */
  colorScheme: ThemeKey
  /**
   * Height to generate image with in pixels (should be around 630px)
   */
  height: number
  /**
   * Width to generate image with in pixels (should be around 1200px)
   */
  width: number
  /**
   * Whether to use the auto generated image for the root path ("/", when set to false) or the default og image (when set to true).
   */
  excludeRoot: boolean
  /**
   * JSX to use for generating image. See satori docs for more info (https://github.com/vercel/satori)
   */
  imageStructure: (
    options: ImageOptions & {
      userOpts: UserOpts
      iconBase64?: string
    },
  ) => JSXInternal.Element
}

export type UserOpts = Omit<SocialImageOptions, "imageStructure">

export type ImageOptions = {
  /**
   * what title to use as header in image
   */
  title: string
  /**
   * what description to use as body in image
   */
  description: string
  /**
   * header + body font to be used when generating satori image (as promise to work around sync in component)
   */
  fonts: SatoriOptions["fonts"]
  /**
   * `GlobalConfiguration` of quartz (used for theme/typography)
   */
  cfg: GlobalConfiguration
  /**
   * full file data of current page
   */
  fileData: QuartzPluginData
}
// This is the default template for generated social image.
export const defaultImage: SocialImageOptions["imageStructure"] = ({
  cfg,
  userOpts,
  title,
  description,
  fileData,
  iconBase64,
}) => {
  const fontBreakPoint = 32
  const useSmallerFont = title.length > fontBreakPoint

  // Format date if available
  const rawDate = getDate(cfg, fileData)
  const date = rawDate ? formatDate(rawDate, cfg.locale) : null

  // Calculate reading time
  const { minutes } = readingTime(fileData.text ?? "")
  const readingTimeText = i18n(cfg.locale).components.contentMeta.readingTime({
    minutes: Math.ceil(minutes),
  })

  // Get tags if available
  const tags = fileData.frontmatter?.tags ?? []
  const bodyFont = getFontSpecificationName(cfg.theme.typography.body)
  const headerFont = getFontSpecificationName(cfg.theme.typography.header)

  // Custom Colors extracted from your theme
  const colors = {
    bg: "#1c1715", // Deep warm dark brown/black
    primaryOrbs: "#e87a3e", // The brand orange for the glowing effect
    siteName: "#e87a3e", // Deep orange
    title: "#ff9d5c", // Brighter orange for the main heading
    text: "#d6cdc4", // Warm off-white for description readability
    meta: "#a19589", // Dimmer warm gray for dates/times
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        backgroundColor: colors.bg,
        fontFamily: bodyFont,
        position: "relative",
        overflow: "hidden", // Keeps the glowing orbs from spilling out
      }}
    >
      {/* BACKGROUND: Fuzzy Orange Blurred Balls */}
      {/* We use SVG radial gradients because Satori doesn't support CSS blurs */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 0,
        }}
      >
        <svg style={{ width: "100%", height: "100%" }} viewBox="0 0 1200 630">
          <defs>
            {/* Top Left Orb */}
            <radialGradient id="glow1" cx="10%" cy="10%" r="50%">
              <stop offset="0%" stopColor={colors.primaryOrbs} stopOpacity="0.35" />
              <stop offset="100%" stopColor={colors.primaryOrbs} stopOpacity="0" />
            </radialGradient>
            {/* Bottom Right Orb */}
            <radialGradient id="glow2" cx="90%" cy="90%" r="60%">
              <stop offset="0%" stopColor={colors.primaryOrbs} stopOpacity="0.25" />
              <stop offset="100%" stopColor={colors.primaryOrbs} stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#glow1)" />
          <rect width="100%" height="100%" fill="url(#glow2)" />
        </svg>
      </div>

      {/* CONTENT WRAPPER */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          width: "100%",
          padding: "3.5rem",
          zIndex: 1, // Sit above the background SVG
        }}
      >
        {/* Header Section */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            marginBottom: "0.5rem",
          }}
        >
          {iconBase64 && (
            <img
              src={iconBase64}
              width={56}
              height={56}
              style={{
                borderRadius: "50%",
              }}
            />
          )}
          <div
            style={{
              display: "flex",
              fontSize: 32,
              fontWeight: 700,
              color: colors.siteName,
              fontFamily: bodyFont,
            }}
          >
            {cfg.baseUrl}
          </div>
        </div>

        {/* Title Section */}
        <div
          style={{
            display: "flex",
            marginTop: "1.5rem",
            marginBottom: "1.5rem",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: useSmallerFont ? 64 : 76,
              fontFamily: headerFont,
              fontWeight: 700,
              color: colors.title,
              lineHeight: 1.1,
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {title}
          </h1>
        </div>

        {/* Description Section */}
        <div
          style={{
            display: "flex",
            flex: 1,
            fontSize: 36,
            color: colors.text,
            lineHeight: 1.4,
          }}
        >
          <p
            style={{
              margin: 0,
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 4,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {description}
          </p>
        </div>

        {/* Footer with Metadata */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "2rem",
            paddingTop: "2rem",
            borderTop: `1px solid rgba(232, 122, 62, 0.2)`, // Faint orange border
          }}
        >
          {/* Left side - Date and Reading Time */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "2rem",
              color: colors.meta,
              fontSize: 28,
            }}
          >
            {date && (
              <div style={{ display: "flex", alignItems: "center" }}>
                <svg
                  style={{ marginRight: "0.5rem" }}
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                {date}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center" }}>
              <svg
                style={{ marginRight: "0.5rem" }}
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              {readingTimeText}
            </div>
          </div>

          {/* Right side - Tags */}
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              flexWrap: "wrap",
              justifyContent: "flex-end",
              maxWidth: "60%",
            }}
          >
            {tags.slice(0, 3).map((tag: string) => (
              <div
                style={{
                  display: "flex",
                  padding: "0.5rem 1.25rem",
                  backgroundColor: "rgba(232, 122, 62, 0.1)", // Very transparent orange
                  color: colors.title,
                  border: `1px solid rgba(232, 122, 62, 0.3)`,
                  borderRadius: "999px", // Pill shape
                  fontSize: 24,
                }}
              >
                #{tag}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
