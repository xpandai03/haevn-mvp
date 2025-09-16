"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { ArrowRight, Menu, X, Zap, Settings2, Sparkles } from "lucide-react"
import { motion, type Variants } from "framer-motion"

function cn(...classes: (string | undefined | null | boolean)[]): string {
  return classes.filter(Boolean).join(" ")
}

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  },
)
Button.displayName = "Button"

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)} {...props} />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  ),
)
CardHeader.displayName = "CardHeader"

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />,
)
CardContent.displayName = "CardContent"

const defaultContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const defaultItemVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

function AnimatedGroup({
  children,
  className,
  variants,
}: {
  children: React.ReactNode
  className?: string
  variants?: {
    container?: Variants
    item?: Variants
  }
}) {
  const containerVariants = variants?.container || defaultContainerVariants
  const itemVariants = variants?.item || defaultItemVariants

  return (
    <motion.div initial="hidden" animate="visible" variants={containerVariants} className={cn(className)}>
      {React.Children.map(children, (child, index) => (
        <motion.div key={index} variants={itemVariants}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  )
}

const transitionVariants = {
  item: {
    hidden: {
      opacity: 0,
      filter: "blur(12px)",
      y: 12,
    },
    visible: {
      opacity: 1,
      filter: "blur(0px)",
      y: 0,
      transition: {
        type: "spring",
        bounce: 0.3,
        duration: 1.5,
      },
    },
  },
}

const menuItems = [
  { name: "Services", href: "#services" },
  { name: "Solutions", href: "#solutions" },
  { name: "About", href: "#about" },
  { name: "Contact", href: "#contact" },
]

const HeroHeader = () => {
  const [menuState, setMenuState] = React.useState(false)
  const [isScrolled, setIsScrolled] = React.useState(false)

  React.useEffect(() => {
    if (typeof window === "undefined") return

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <header>
      <nav data-state={menuState && "active"} className="fixed z-20 w-full px-2 group">
        <div
          className={cn(
            "mx-auto mt-1 max-w-4xl px-4 transition-all duration-300 lg:px-8",
            isScrolled && "bg-background/50 max-w-3xl rounded-2xl border backdrop-blur-lg lg:px-4",
          )}
        >
          <div className="relative flex flex-wrap items-center justify-between gap-6 py-3 lg:gap-0 lg:py-0">
            <div className="flex w-full justify-between lg:w-auto">
              <a href="/" aria-label="home" className="flex items-center space-x-2">
                <Logo />
              </a>

              <button
                onClick={() => setMenuState(!menuState)}
                aria-label={menuState == true ? "Close Menu" : "Open Menu"}
                className="relative z-20 -m-2.5 -mr-4 block cursor-pointer p-2.5 lg:hidden"
              >
                <Menu className="in-data-[state=active]:rotate-180 group-data-[state=active]:scale-0 group-data-[state=active]:opacity-0 m-auto size-6 duration-200" />
                <X className="group-data-[state=active]:rotate-0 group-data-[state=active]:scale-100 group-data-[state=active]:opacity-100 absolute inset-0 m-auto size-6 -rotate-180 scale-0 opacity-0 duration-200" />
              </button>
            </div>

            <div className="absolute inset-0 m-auto hidden size-fit lg:block">
              <ul className="flex gap-8 text-sm">
                {menuItems.map((item, index) => (
                  <li key={index}>
                    <a
                      href={item.href}
                      className="text-muted-foreground hover:text-accent-foreground block duration-150"
                    >
                      <span>{item.name}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-background group-data-[state=active]:block lg:group-data-[state=active]:flex mb-6 hidden w-full flex-wrap items-center justify-end space-y-8 rounded-3xl border p-6 shadow-2xl shadow-zinc-300/20 md:flex-nowrap lg:m-0 lg:flex lg:w-fit lg:gap-6 lg:space-y-0 lg:border-transparent lg:bg-transparent dark:shadow-none dark:lg:bg-transparent">
              <div className="lg:hidden">
                <ul className="space-y-6 text-base">
                  {menuItems.map((item, index) => (
                    <li key={index}>
                      <a
                        href={item.href}
                        className="text-muted-foreground hover:text-accent-foreground block duration-150"
                      >
                        <span>{item.name}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex w-full flex-col space-y-3 sm:flex-row sm:gap-3 sm:space-y-0 md:w-fit">
                <Button variant="outline" size="sm" className={cn(isScrolled && "lg:hidden")}>
                  <span>Login</span>
                </Button>
                <Button
                  size="sm"
                  className={cn(
                    isScrolled
                      ? "lg:inline-flex bg-orange-500 hover:bg-orange-600"
                      : "hidden bg-orange-500 hover:bg-orange-600",
                  )}
                >
                  <span>Get Started</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </header>
  )
}

const Logo = ({ className }: { className?: string }) => {
  return (
    <div className={cn("flex items-center space-x-3", className)}>
      <svg width="32" height="32" viewBox="0 0 32 32" className="text-foreground">
        <g fill="currentColor" stroke="currentColor" strokeWidth="1.5">
          {/* Left interconnected loops */}
          <circle cx="8" cy="12" r="4" fill="none" />
          <circle cx="8" cy="20" r="4" fill="none" />

          {/* Right interconnected loops */}
          <circle cx="24" cy="12" r="4" fill="none" />
          <circle cx="24" cy="20" r="4" fill="none" />

          {/* Horizontal connecting elements */}
          <path d="M12 12 L20 12" stroke="currentColor" strokeWidth="2" />
          <path d="M12 20 L20 20" stroke="currentColor" strokeWidth="2" />

          {/* Vertical connecting elements */}
          <path d="M8 8 L8 16" stroke="currentColor" strokeWidth="2" />
          <path d="M8 16 L8 24" stroke="currentColor" strokeWidth="2" />
          <path d="M24 8 L24 16" stroke="currentColor" strokeWidth="2" />
          <path d="M24 16 L24 24" stroke="currentColor" strokeWidth="2" />

          {/* Central connecting cross pattern */}
          <path d="M12 16 L20 16" stroke="currentColor" strokeWidth="1.5" />
          <path d="M16 12 L16 20" stroke="currentColor" strokeWidth="1.5" />

          {/* Corner connection elements */}
          <circle cx="16" cy="16" r="1.5" fill="currentColor" />
        </g>
      </svg>

      <span className="text-xl font-bold tracking-wider text-foreground">HAEVN</span>
    </div>
  )
}

const CardDecorator = ({ children }: { children: React.ReactNode }) => (
  <div
    aria-hidden
    className="relative mx-auto size-36 [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)]"
  >
    <div className="absolute inset-0 [--border:black] dark:[--border:white] bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:24px_24px] opacity-10" />
    <div className="bg-background absolute inset-0 m-auto flex size-12 items-center justify-center border-t border-l border-orange-200">
      {children}
    </div>
  </div>
)

export default function SoftwareDevelopmentWebsite() {
  const [currentImageIndex, setCurrentImageIndex] = React.useState(0)
  const carouselImages = [
    "/images/throuple-colorful-moment.jpeg",
    "/images/happy-couple-beach.jpeg",
    "/images/three-women-supportive.webp",
    "/images/couple-intimate-scene.avif",
  ]

  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % carouselImages.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [carouselImages.length])

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % carouselImages.length)
  }

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + carouselImages.length) % carouselImages.length)
  }

  const gridItems = [
    "/images/throuple-colorful-moment.jpeg",
    "/images/happy-couple-beach.jpeg",
    "/images/three-women-supportive.webp",
    "/images/couple-intimate-scene.avif",
    "/diverse-couple-holding-hands-outdoors.png",
    "/lgbtq-couple-embracing-in-natural-lighting.png",
    "/polyamorous-relationship-happy-moment.png",
    "/bisexual-person-confident-portrait.png",
    "/non-binary-person-smiling-authentically.png",
    "/interracial-couple-on-romantic-date.png",
    "/alternative-lifestyle-couple-with-tattoos.png",
    "/mature-couple-in-loving-embrace.png",
    "/young-professional-looking-for-connection.png",
    "/diverse-dating-app-users-connecting.png",
    "/authentic-relationship-moments.png",
    "/inclusive-dating-community.png",
    "/modern-romance-and-connection.png",
    "/genuine-dating-experiences.png",
    "/meaningful-relationships-forming.png",
    "/dating-app-success-stories.png",
    "/real-connections-being-made.png",
    "/authentic-love-and-partnership.png",
    "/diverse-people-finding-love.png",
    "/multicultural-group-socializing.png",
    "/same-sex-couple-sharing-intimate-moment.png",
  ]

  return (
    <div>
      <HeroHeader />
      <main className="overflow-hidden">
        <div
          aria-hidden
          className="z-[2] absolute inset-0 pointer-events-none isolate opacity-50 contain-strict hidden lg:block"
        >
          <div className="w-[35rem] h-[80rem] -translate-y-[350px] absolute left-0 top-0 -rotate-45 rounded-full bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,hsla(25,100%,50%,.08)_0,hsla(25,100%,45%,.02)_50%,hsla(25,100%,40%,0)_80%)]" />
          <div className="h-[80rem] absolute left-0 top-0 w-56 -rotate-45 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,hsla(25,100%,50%,.06)_0,hsla(25,100%,45%,.02)_80%,transparent_100%)] [translate:5%_-50%]" />
        </div>

        <section>
          <div className="relative pt-24 md:pt-36">
            <div
              aria-hidden
              className="absolute inset-0 -z-10 size-full [background:radial-gradient(125%_125%_at_50%_100%,transparent_0%,var(--background)_75%)]"
            />
            <div className="mx-auto max-w-7xl px-6">
              <div className="text-center sm:mx-auto lg:mr-auto lg:mt-0">
                <AnimatedGroup variants={transitionVariants}>
                  <a
                    href="#services"
                    className="hover:bg-background dark:hover:border-t-border bg-muted group mx-auto flex w-fit items-center gap-4 rounded-full border p-1 pl-4 shadow-md shadow-black/5 transition-all duration-300 dark:border-t-white/5 dark:shadow-zinc-950"
                  >
                    <span className="text-foreground text-sm">Custom Software Solutions for Small Business</span>
                    <span className="dark:border-background block h-4 w-0.5 border-l bg-white dark:bg-zinc-700"></span>

                    <div className="bg-background group-hover:bg-muted size-6 overflow-hidden rounded-full duration-500">
                      <div className="flex w-12 -translate-x-1/2 duration-500 ease-in-out group-hover:translate-x-0">
                        <span className="flex size-6">
                          <ArrowRight className="m-auto size-3" />
                        </span>
                        <span className="flex size-6">
                          <ArrowRight className="m-auto size-3" />
                        </span>
                      </div>
                    </div>
                  </a>

                  <h1 className="mt-8 max-w-4xl mx-auto text-balance text-6xl md:text-7xl lg:mt-16 xl:text-[5.25rem]">
                    Swiping is easy{" "}
                    <span className="inline-block text-orange-500 text-6xl md:text-7xl xl:text-[5.25rem] font-semibold">
                      Finding a real match isn't.
                    </span>
                  </h1>
                  <p className="mx-auto mt-8 max-w-2xl text-balance text-lg text-muted-foreground">
                    Especially if you're ENM, bisexual, or don't fit the traditional mold. That's why we created HAEVN.
                  </p>
                </AnimatedGroup>

                <AnimatedGroup
                  variants={{
                    container: {
                      visible: {
                        transition: {
                          staggerChildren: 0.05,
                          delayChildren: 0.75,
                        },
                      },
                    },
                    ...transitionVariants,
                  }}
                  className="mt-12 flex flex-col items-center justify-center gap-2 md:flex-row"
                >
                  <div key={1} className="bg-orange-500/10 rounded-[14px] border border-orange-200 p-0.5">
                    <Button size="lg" className="rounded-xl px-5 text-base bg-orange-500 hover:bg-orange-600">
                      <span className="text-nowrap">waitlist
</span>
                    </Button>
                  </div>
                </AnimatedGroup>
              </div>
            </div>

            <AnimatedGroup
              variants={{
                container: {
                  visible: {
                    transition: {
                      staggerChildren: 0.05,
                      delayChildren: 0.75,
                    },
                  },
                },
                ...transitionVariants,
              }}
            >
              <div className="relative -mr-56 mt-8 overflow-hidden px-2 sm:mr-0 sm:mt-12 md:mt-20">
                <div
                  aria-hidden
                  className="bg-gradient-to-b to-background absolute inset-0 z-10 from-transparent from-35%"
                />
                <div className="inset-shadow-2xs ring-background dark:inset-shadow-white/20 bg-background relative mx-auto max-w-6xl overflow-hidden rounded-2xl border border-orange-200 p-4 shadow-lg shadow-orange-500/15 ring-1">
                  <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 aspect-video relative rounded-2xl border border-orange-200 overflow-hidden">
                    <div className="relative h-full w-full">
                      <img
                        src={carouselImages[currentImageIndex] || "/placeholder.svg"}
                        alt={`HAEVN community image ${currentImageIndex + 1}`}
                        className="h-full w-full object-cover transition-opacity duration-500"
                      />
                      <button
                        onClick={prevImage}
                        className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 rounded-full p-2 shadow-lg transition-all duration-200 hover:scale-110"
                        aria-label="Previous image"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <button
                        onClick={nextImage}
                        className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 rounded-full p-2 shadow-lg transition-all duration-200 hover:scale-110"
                        aria-label="Next image"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2">
                        {carouselImages.map((_, index) => (
                          <button
                            key={index}
                            onClick={() => setCurrentImageIndex(index)}
                            className={`w-2 h-2 rounded-full transition-all duration-200 ${
                              index === currentImageIndex ? "bg-white scale-125" : "bg-white/50 hover:bg-white/75"
                            }`}
                            aria-label={`Go to image ${index + 1}`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </AnimatedGroup>
          </div>
        </section>

        <section className="bg-muted/50 py-16 md:py-32 dark:bg-transparent">
          <div className="@container mx-auto max-w-5xl px-6">
            <div className="text-center">
              <h2 className="text-balance text-4xl font-semibold lg:text-5xl">
                Why Choose <span className="text-orange-500">HAEVN</span>
              </h2>
              <p className="mt-4 text-muted-foreground">
                A dating app built for connection. Not just matches.

              </p>
            </div>
            <Card className="@min-4xl:max-w-full @min-4xl:grid-cols-3 @min-4xl:divide-x @min-4xl:divide-y-0 mx-auto mt-8 grid max-w-sm divide-y overflow-hidden shadow-zinc-950/5 border-orange-200 *:text-center md:mt-16">
              <div className="group shadow-zinc-950/5">
                <CardHeader className="pb-3">
                  <CardDecorator>
                    <Zap className="size-6 text-orange-500" aria-hidden />
                  </CardDecorator>

                  <h3 className="mt-6 font-medium">Fast Development</h3>
                </CardHeader>

                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Rapid prototyping and agile development process to get your software to market quickly.
                  </p>
                </CardContent>
              </div>

              <div className="group shadow-zinc-950/5">
                <CardHeader className="pb-3">
                  <CardDecorator>
                    <Settings2 className="size-6 text-orange-500" aria-hidden />
                  </CardDecorator>

                  <h3 className="mt-6 font-medium">Scalable Solutions</h3>
                </CardHeader>

                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Built to grow with your business, our solutions scale seamlessly as your needs evolve.
                  </p>
                </CardContent>
              </div>

              <div className="group shadow-zinc-950/5">
                <CardHeader className="pb-3">
                  <CardDecorator>
                    <Sparkles className="size-6 text-orange-500" aria-hidden />
                  </CardDecorator>

                  <h3 className="mt-6 font-medium">Modern Technology</h3>
                </CardHeader>

                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Using the latest technologies and best practices to ensure your software is future-proof.
                  </p>
                </CardContent>
              </div>
            </Card>
          </div>
        </section>
      </main>

      <footer className="bg-background border-t border-orange-200">
        <div className="mx-auto max-w-7xl py-16 px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
            {/* Company Info */}
            <div className="space-y-4 sm:col-span-2 lg:col-span-1">
              <Logo />
              <p className="text-sm text-muted-foreground max-w-xs">
                Transform your business with custom software solutions. We build scalable applications that grow with
                your success.
              </p>
              <div className="flex space-x-4">
                <a href="#" className="text-muted-foreground hover:text-orange-500 transition-colors">
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fillRule="evenodd"
                      d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"
                      clipRule="evenodd"
                    />
                  </svg>
                </a>
                <a href="#" className="text-muted-foreground hover:text-orange-500 transition-colors">
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </a>
                <a href="#" className="text-muted-foreground hover:text-orange-500 transition-colors">
                  <svg className="h-5 w-5 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                </a>
              </div>

              {/* Services */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Services</h3>
                <ul className="space-y-2 text-sm">
                  <li>
                    <a href="#" className="text-muted-foreground hover:text-orange-500 transition-colors">
                      Web Development
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-muted-foreground hover:text-orange-500 transition-colors">
                      Mobile Apps
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-muted-foreground hover:text-orange-500 transition-colors">
                      Custom Software
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-muted-foreground hover:text-orange-500 transition-colors">
                      API Development
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-muted-foreground hover:text-orange-500 transition-colors">
                      Cloud Solutions
                    </a>
                  </li>
                </ul>
              </div>

              {/* Company */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Company</h3>
                <ul className="space-y-2 text-sm">
                  <li>
                    <a href="#" className="text-muted-foreground hover:text-orange-500 transition-colors">
                      About Us
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-muted-foreground hover:text-orange-500 transition-colors">
                      Our Team
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-muted-foreground hover:text-orange-500 transition-colors">
                      Careers
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-muted-foreground hover:text-orange-500 transition-colors">
                      Case Studies
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-muted-foreground hover:text-orange-500 transition-colors">
                      Blog
                    </a>
                  </li>
                </ul>
              </div>

              {/* Contact */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Contact</h3>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex items-center space-x-2">
                    <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                    <span className="break-all">hello@devsolutions.com</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    <span>+1 (555) 123-4567</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <svg className="h-4 w-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    <span>
                      123 Tech Street
                      <br />
                      San Francisco, CA 94105
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Bottom section */}
            <div className="mt-12 pt-8 border-t border-orange-200">
              <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
                <div className="text-sm text-muted-foreground">© 2024 DevSolutions. All rights reserved.</div>
                <div className="flex flex-wrap justify-center sm:justify-end gap-x-6 gap-y-2 text-sm">
                  <a href="#" className="text-muted-foreground hover:text-orange-500 transition-colors">
                    Privacy Policy
                  </a>
                  <a href="#" className="text-muted-foreground hover:text-orange-500 transition-colors">
                    Terms of Service
                  </a>
                  <a href="#" className="text-muted-foreground hover:text-orange-500 transition-colors">
                    Cookie Policy
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
