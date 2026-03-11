'use client'

import * as React from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Button } from '@/components/ui/button'

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs))
}

function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) handler()
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [ref, handler])
}

export interface AnimatedDropdownItem {
  name: string
  link?: string
  onSelect?: () => void
  icon?: React.ComponentType<{ size?: number; className?: string }>
  disabled?: boolean
}

export interface AnimatedDropdownProps {
  items?: AnimatedDropdownItem[]
  text?: string
  className?: string
  buttonClassName?: string
  triggerContent?: React.ReactNode
  triggerStartIcon?: React.ComponentType<{ size?: number; className?: string }>
  showChevron?: boolean
  buttonVariant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger'
  buttonSize?: 'sm' | 'md' | 'lg'
  align?: 'left' | 'center' | 'right'
}

const DEMO: AnimatedDropdownItem[] = [
  { name: 'Documentation', link: '#' },
  { name: 'Components', link: '#' },
  { name: 'Examples', link: '#' },
  { name: 'GitHub', link: '#' },
]

export default function AnimatedDropdown({
  items = DEMO,
  text = 'Select Option',
  className,
  buttonClassName,
  triggerContent,
  triggerStartIcon: TriggerStartIcon,
  showChevron = true,
  buttonVariant = 'outline',
  buttonSize = 'md',
  align = 'center',
}: AnimatedDropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  const menuPositionClass =
    align === 'left'
      ? 'left-0 translate-x-0'
      : align === 'right'
        ? 'right-0 left-auto translate-x-0'
        : 'left-1/2 -translate-x-1/2'

  return (
    <OnClickOutside onClickOutside={() => setIsOpen(false)}>
      <div data-state={isOpen ? 'open' : 'closed'} className={cn('relative inline-block', className)}>
        <Button
          variant={buttonVariant}
          size={buttonSize}
          aria-haspopup='listbox'
          aria-expanded={isOpen}
          onClick={() => setIsOpen((prev) => !prev)}
          className={cn('gap-2', buttonClassName)}
        >
          {triggerContent ? (
            triggerContent
          ) : (
            <>
              {TriggerStartIcon ? <TriggerStartIcon size={14} className='shrink-0' /> : null}
              <span>{text}</span>
            </>
          )}
          {showChevron ? (
            <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2, ease: 'easeInOut' }}>
              <ChevronDown className='h-4 w-4' />
            </motion.div>
          ) : null}
        </Button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              role='listbox'
              initial={{ opacity: 0, y: -10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.96 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className={cn(
                'absolute top-[calc(100%+0.5rem)] z-50 min-w-full overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]',
                menuPositionClass
              )}
            >
              <motion.div
                initial='hidden'
                animate='visible'
                variants={{
                  visible: {
                    transition: {
                      staggerChildren: 0.03,
                    },
                  },
                }}
              >
                {items.map((item, index) => (
                  <motion.div
                    key={`${item.name}-${index}`}
                    variants={{
                      hidden: { opacity: 0, x: -12 },
                      visible: { opacity: 1, x: 0 },
                    }}
                  >
                    {item.link && !item.disabled ? (
                      <Link
                        href={item.link}
                        className={cn(
                          'flex w-full items-center gap-2 border-b border-[var(--border)] px-3 py-2 text-sm text-[var(--text)] no-underline transition-colors last:border-b-0',
                          'bg-[var(--surface)] hover:bg-[var(--surface-2)]'
                        )}
                        onClick={() => setIsOpen(false)}
                      >
                        {item.icon ? <item.icon size={14} className='shrink-0 opacity-70' /> : null}
                        <span>{item.name}</span>
                      </Link>
                    ) : (
                      <button
                        type='button'
                        disabled={item.disabled}
                        className={cn(
                          'flex w-full items-center gap-2 border-b border-[var(--border)] px-3 py-2 text-left text-sm transition-colors last:border-b-0',
                          item.disabled
                            ? 'cursor-not-allowed bg-[var(--surface)] text-[var(--muted-text)] opacity-60'
                            : 'bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-2)]'
                        )}
                        onClick={() => {
                          item.onSelect?.()
                          setIsOpen(false)
                        }}
                      >
                        {item.icon ? <item.icon size={14} className='shrink-0 opacity-70' /> : null}
                        <span>{item.name}</span>
                      </button>
                    )}
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </OnClickOutside>
  )
}

interface OnClickOutsideProps {
  children: React.ReactNode
  onClickOutside: () => void
  className?: string
}

function OnClickOutside({ children, onClickOutside, className }: OnClickOutsideProps) {
  const wrapperRef = React.useRef<HTMLDivElement>(null)
  useClickOutside(wrapperRef, onClickOutside)

  return (
    <div ref={wrapperRef} className={cn(className)}>
      {children}
    </div>
  )
}
