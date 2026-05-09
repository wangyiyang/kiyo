declare module 'next/link' {
  import { ComponentType, AnchorHTMLAttributes } from 'react'
  
  interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
    href: string
    replace?: boolean
    scroll?: boolean
    shallow?: boolean
    passHref?: boolean
    prefetch?: boolean
    locale?: string | false
    legacyBehavior?: boolean
    className?: string
    children?: React.ReactNode
  }
  
  const Link: ComponentType<LinkProps>
  export default Link
}
