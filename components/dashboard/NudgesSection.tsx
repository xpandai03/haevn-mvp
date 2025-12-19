import Link from 'next/link'
import Image from 'next/image'

interface Nudge {
    id: string
    senderId: string
    senderPartnershipId: string
    photo?: string
    username: string
    city?: string
    compatibilityPercentage: number
    topFactor: string
    nudgedAt: Date
    isRead: boolean
}

interface NudgesSectionProps {
    nudges: Nudge[]
}

export function NudgesSection({ nudges }: NudgesSectionProps) {
    const totalNudges = (nudges ?? []).length

    return (
        <section className="space-y-2">
            {/* Section Header */}
            <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-medium text-gray-900">
                    Nudges ({totalNudges})
                </h3>
                {totalNudges > 0 && (
                    <Link
                        href="/dashboard/nudges"
                        className="text-sm text-gray-500 hover:text-gray-700"
                    >
                        View All
                    </Link>
                )}
            </div>

            {/* Horizontal Scroll Container */}
            <div className="relative">
                <div className="overflow-x-auto pb-2 -mx-4 px-4">
                    <div className="flex gap-3" style={{ minWidth: 'min-content' }}>
                        {totalNudges > 0 ? (
                            nudges.slice(0, 5).map((nudge) => (
                                <Link
                                    key={nudge.id}
                                    href={`/dashboard/nudges`}
                                    className="flex-shrink-0 w-32 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all cursor-pointer overflow-hidden"
                                >
                                    {/* Photo */}
                                    <div className="relative w-full h-24 bg-gray-100">
                                        {nudge.photo ? (
                                            <Image
                                                src={nudge.photo}
                                                alt={nudge.username}
                                                fill
                                                className="object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <span className="text-2xl text-gray-300">
                                                    {nudge.username.charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                        )}
                                        {/* Unread indicator */}
                                        {!nudge.isRead && (
                                            <div className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full" />
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="p-2 space-y-1">
                                        <p className="text-xs font-medium text-gray-900 truncate">
                                            {nudge.username}
                                        </p>
                                        {nudge.city && (
                                            <p className="text-[10px] text-gray-500 truncate">
                                                {nudge.city}
                                            </p>
                                        )}
                                        <div className="flex items-center gap-1">
                                            <span className="text-[10px] font-medium text-green-600">
                                                {nudge.compatibilityPercentage}%
                                            </span>
                                            <span className="text-[10px] text-gray-400">match</span>
                                        </div>
                                    </div>
                                </Link>
                            ))
                        ) : (
                            // Empty state
                            <div className="w-full py-8 text-center">
                                <p className="text-sm text-gray-400">No nudges yet</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Scroll indicator dots */}
                {totalNudges > 1 && (
                    <div className="flex justify-center gap-1 mt-2">
                        {nudges.slice(0, 5).map((nudge, i) => (
                            <div
                                key={nudge.id}
                                className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-gray-400' : 'bg-gray-200'}`}
                            />
                        ))}
                    </div>
                )}
            </div>
        </section>
    )
}
