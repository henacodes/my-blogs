import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"

const ArticleTitle: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
  const title = fileData.frontmatter?.title
  const subtitle = fileData.frontmatter?.subtitle
  const author = fileData.frontmatter?.author

  if (title) {
    return (
      <div class={classNames(displayClass, "article-header")}>
        <h1 class="article-title">{title}</h1>
        {subtitle && <p class="article-subtitle">{subtitle}</p>}
        {author && <p class="article-author">By {author}</p>}
      </div>
    )
  } else {
    return null
  }
}

ArticleTitle.css = `
.article-header {
  margin: 0 0 0.75rem 0;
}
.article-title {
  margin: 0;
  font-size: clamp(1.85rem, 3vw, 2.75rem);
  line-height: 1.12;
}
.article-subtitle {
  margin-top: 0.5rem;
  color: var(--gray);
  font-size: 0.95rem;
}
.article-author {
  margin-top: 0.25rem;
  color: var(--secondary);
  font-weight: 600;
  font-size: 0.9rem;
}
`

export default (() => ArticleTitle) satisfies QuartzComponentConstructor
