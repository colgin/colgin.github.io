/**
 * PostBio component that queries for data
 * with Gatsby's useStaticQuery component
 *
 * See: https://www.gatsbyjs.com/docs/use-static-query/
 */

import * as React from "react"
import { useStaticQuery, graphql } from "gatsby"
import newGithubIssueUrl from "new-github-issue-url";
import { StaticImage } from "gatsby-plugin-image"

const PostBio = ({ title, location }) => {
  const commentUrl = newGithubIssueUrl({
    user: 'colgin',
    repo: 'colgin.github.io',
    body: `## context \n\n [${title}](${location.href}) \n\n ## description \n\n write something here`
  });

  const data = useStaticQuery(graphql`
    query PostBioQuery {
      site {
        siteMetadata {
          author {
            name
            summary
          }
        }
      }
    }
  `)

  // Set these values by editing "siteMetadata" in gatsby-config.js
  const author = data.site.siteMetadata?.author

  return (
    <div className="bio">
      <StaticImage
        className="bio-avatar"
        layout="fixed"
        formats={["auto", "webp", "avif"]}
        src="../images/avatar.png"
        width={50}
        height={50}
        quality={95}
        alt="Profile picture"
      />
      <p>
        Written by <strong>{author.name}</strong> {author?.summary || null}
        {` `}
        <a href={commentUrl} target="_blank" rel="noreferrer">
          You can comment on github
        </a>
      </p>
    </div>
  )
}

export default PostBio
