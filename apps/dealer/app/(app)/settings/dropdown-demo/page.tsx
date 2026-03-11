import AnimatedDropdown from '@/components/ui/animated-dropdown'

export default function DropdownDemoPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8">
      <AnimatedDropdown
        text="Quick actions"
        items={[
          { name: 'Documentation', link: '#' },
          { name: 'Components', link: '#' },
          { name: 'Examples', link: '#' },
          { name: 'GitHub', link: '#' },
        ]}
      />
    </div>
  )
}
