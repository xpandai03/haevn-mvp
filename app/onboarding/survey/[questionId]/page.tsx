'use client'
import { QuestionRenderer } from "@/components/survey/QuestionRenderer";
import { Button } from "@/components/ui/button";
import { getAllQuestions, surveySections } from "@/lib/survey/questions";
import { useParams } from "next/navigation";

export default function QuestionPage() {
    const { questionId } = useParams()
    const allQuestions = getAllQuestions();
    const currentQuestion = allQuestions.find(q => q.id === questionId)
    const currentSection = surveySections.find(section =>
        section.questions.some(q => q.id === currentQuestion?.id)
    )


    return <main className="flex-1 flex flex-col items-center justify-center px-4 pb-12">
        <div className="w-full max-w-2xl bg-white rounded-3xl shadow-lg p-8 lg:p-12">
            {/* Section title */}
            {currentSection && (
                <div className="mb-6">
                    <h2 className="text-sm text-haevn-gold mb-2" style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {currentSection.title}
                    </h2>
                    {currentSection.description && (
                        <p className="text-sm text-haevn-charcoal/70" style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 300, lineHeight: '120%' }}>
                            {currentSection.description}
                        </p>
                    )}
                </div>
            )}

            {/* Question */}
            {currentQuestion &&
                <QuestionRenderer
                    question={currentQuestion}
                    value={null}
                    onChange={() => { }}
                    onEnterPress={() => { }}
                    canAdvance={false}
                />

            }
            {/* Continue button */}

        </div>

        {/* Question counter */}
    </main>
}