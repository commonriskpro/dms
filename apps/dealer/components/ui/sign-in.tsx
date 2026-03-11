'use client'

import * as React from 'react'
import { Eye, EyeOff, Mail } from 'lucide-react'

export interface Testimonial {
  avatarSrc: string
  name: string
  handle: string
  text: string
}

interface SignInPageProps {
  title?: React.ReactNode
  description?: React.ReactNode
  heroImageSrc?: string
  testimonials?: Testimonial[]
  onSignIn?: (event: React.FormEvent<HTMLFormElement>) => void
  onSecondaryAction?: (data: FormData) => void
  secondaryActionLabel?: string
  secondaryActionIcon?: React.ReactNode
  onResetPassword?: () => void
  onCreateAccount?: () => void
  createAccountLabel?: string
  error?: React.ReactNode
  notice?: React.ReactNode
  isLoading?: boolean
}

const GlassInputWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_78%,transparent)] backdrop-blur-sm transition-colors focus-within:border-[var(--accent)] focus-within:bg-[color-mix(in_srgb,var(--surface-2)_88%,transparent)]">
    {children}
  </div>
)

const TestimonialCard = ({ testimonial, delayClass }: { testimonial: Testimonial; delayClass?: string }) => (
  <div className={`animate-testimonial ${delayClass ?? ''} flex w-64 items-start gap-3 rounded-3xl border border-white/10 bg-[rgba(9,16,31,0.54)] p-5 backdrop-blur-xl`}>
    <img src={testimonial.avatarSrc} className="h-10 w-10 rounded-2xl object-cover" alt={`${testimonial.name} avatar`} />
    <div className="text-sm leading-snug text-white/90">
      <p className="font-medium text-white">{testimonial.name}</p>
      <p className="text-white/55">{testimonial.handle}</p>
      <p className="mt-1 text-white/78">{testimonial.text}</p>
    </div>
  </div>
)

export function SignInPage({
  title = <span className="font-light tracking-tight text-[var(--text)]">Welcome back</span>,
  description = 'Access your account and continue your work in DealerOS.',
  heroImageSrc,
  testimonials = [],
  onSignIn,
  onSecondaryAction,
  secondaryActionLabel = 'Send magic link',
  secondaryActionIcon = <Mail className="h-5 w-5" />,
  onResetPassword,
  onCreateAccount,
  createAccountLabel = 'Accept invite',
  error,
  notice,
  isLoading = false,
}: SignInPageProps) {
  const [showPassword, setShowPassword] = React.useState(false)
  const formRef = React.useRef<HTMLFormElement>(null)

  return (
    <div className="flex min-h-[100dvh] w-full flex-col overflow-hidden bg-[var(--page-bg)] md:flex-row">
      <section className="relative flex flex-1 items-center justify-center px-6 py-10 md:px-10 lg:px-14">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.14),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.08),transparent_34%)]" />
        <div className="relative z-10 w-full max-w-md">
          <div className="flex flex-col gap-6">
            <div className="space-y-3">
              <h1 className="animate-element animate-delay-100 text-4xl font-semibold leading-tight md:text-5xl">{title}</h1>
              <p className="animate-element animate-delay-200 max-w-md text-[var(--muted-text)]">{description}</p>
            </div>

            {notice ? (
              <div className="animate-element animate-delay-250 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/90 px-4 py-3 text-sm text-[var(--muted-text)] shadow-[var(--shadow-card)]">
                {notice}
              </div>
            ) : null}

            {error ? (
              <div className="animate-element animate-delay-260 rounded-2xl border border-[var(--danger)] bg-[var(--danger-muted)]/88 px-4 py-3 text-sm text-[var(--danger-muted-fg)] shadow-[var(--shadow-card)]">
                {error}
              </div>
            ) : null}

            <form ref={formRef} className="space-y-5" onSubmit={onSignIn}>
              <div className="animate-element animate-delay-300 space-y-2">
                <label className="text-sm font-medium text-[var(--muted-text)]">Email address</label>
                <GlassInputWrapper>
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="Enter your email address"
                    className="w-full rounded-2xl bg-transparent p-4 text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted-text)]"
                  />
                </GlassInputWrapper>
              </div>

              <div className="animate-element animate-delay-400 space-y-2">
                <label className="text-sm font-medium text-[var(--muted-text)]">Password</label>
                <GlassInputWrapper>
                  <div className="relative">
                    <input
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      className="w-full rounded-2xl bg-transparent p-4 pr-12 text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted-text)]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-3 flex items-center text-[var(--muted-text)] transition-colors hover:text-[var(--text)]"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </GlassInputWrapper>
              </div>

              <div className="animate-element animate-delay-500 flex items-center justify-between text-sm">
                <label className="flex items-center gap-3 text-[var(--text)]/90">
                  <input type="checkbox" name="rememberMe" className="custom-checkbox" />
                  <span>Keep me signed in</span>
                </label>
                <button
                  type="button"
                  onClick={onResetPassword}
                  className="text-[var(--accent)] transition-colors hover:underline"
                >
                  Reset password
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="animate-element animate-delay-600 w-full rounded-2xl bg-[var(--primary)] py-4 font-medium text-white transition-colors hover:bg-[var(--primary-hover)] disabled:opacity-60"
              >
                {isLoading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

            <div className="animate-element animate-delay-700 relative flex items-center justify-center">
              <span className="w-full border-t border-[var(--border)]" />
              <span className="absolute bg-[var(--page-bg)] px-4 text-sm text-[var(--muted-text)]">Or continue with</span>
            </div>

            <button
              type="button"
              onClick={() => {
                if (!formRef.current) return
                onSecondaryAction?.(new FormData(formRef.current))
              }}
              className="animate-element animate-delay-800 flex w-full items-center justify-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] py-4 text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]"
            >
              {secondaryActionIcon}
              {secondaryActionLabel}
            </button>

            <p className="animate-element animate-delay-900 text-center text-sm text-[var(--muted-text)]">
              Need dealership access?{' '}
              <button type="button" onClick={onCreateAccount} className="text-[var(--accent)] transition-colors hover:underline">
                {createAccountLabel}
              </button>
            </p>
          </div>
        </div>
      </section>

      {heroImageSrc ? (
        <section className="relative hidden flex-1 p-4 md:block">
          <div
            className="animate-slide-right animate-delay-300 absolute inset-4 rounded-[32px] bg-cover bg-center shadow-[0_30px_80px_rgba(2,6,23,0.42)]"
            style={{ backgroundImage: `linear-gradient(180deg, rgba(9,16,31,0.08) 0%, rgba(9,16,31,0.42) 100%), url(${heroImageSrc})` }}
          />
          {testimonials.length > 0 ? (
            <div className="absolute bottom-8 left-1/2 flex w-full -translate-x-1/2 justify-center gap-4 px-8">
              <TestimonialCard testimonial={testimonials[0]} delayClass="animate-delay-1000" />
              {testimonials[1] ? (
                <div className="hidden xl:flex">
                  <TestimonialCard testimonial={testimonials[1]} delayClass="animate-delay-1200" />
                </div>
              ) : null}
              {testimonials[2] ? (
                <div className="hidden 2xl:flex">
                  <TestimonialCard testimonial={testimonials[2]} delayClass="animate-delay-1400" />
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

