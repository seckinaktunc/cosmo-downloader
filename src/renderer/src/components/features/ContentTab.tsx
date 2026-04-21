/* eslint-disable prettier/prettier */
import { Content, useUiStore } from '@renderer/stores/uiStore'
import Icon, { IconName } from '../miscellaneous/Icon'
import { cn } from '@renderer/lib/utils'

interface ContentTabProps {
    tabs: ContentTabItem[]
}

export interface ContentTabItem {
    id: Content
    title?: string
    content: React.ReactNode
    icon?: IconName
}

export default function ContentTab({ tabs }: ContentTabProps): React.JSX.Element {
    const activeContent = useUiStore((state) => state.activeContent)
    const setActiveContent = useUiStore((state) => state.setActiveContent)

    return (
        <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-linear-to-b from-dark to-white/10">
            <div className="flex w-full divide-x divide-white/10">
                {tabs.map((tab) => {
                    const isActive = activeContent === tab.id

                    return (
                        <div
                            key={tab.id}
                            className={cn(
                                "flex gap-2 items-center justify-center py-2 px-3",
                                tab.title && "flex-1",
                                isActive
                                    ? "bg-dark text-white mb-px"
                                    : "bg-black border-b border-white/10 text-white/50 hover:bg-dark cursor-pointer"
                            )}
                            onClick={() => !isActive && setActiveContent(tab.id)}
                        >
                            {tab.icon && <Icon name={tab.icon} filled={isActive} />}
                            {tab.title}
                        </div>
                    )
                })}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
                {tabs.find((tab) => tab.id === activeContent)?.content}
            </div>
        </div>
    )
}
