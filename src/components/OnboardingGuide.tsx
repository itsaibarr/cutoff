import { useState } from 'react';
import styles from './OnboardingGuide.module.css';
import { Sparkles, Zap, ShieldAlert, Timer, CheckCircle, Flame } from 'lucide-react';
import clsx from 'clsx';

interface OnboardingGuideProps {
    onComplete: () => void;
}

const STEPS = [
    {
        icon: <Sparkles size={24} />,
        title: "Welcome to Cutoff",
        description: "This isn't a bookmark manager. It's a decision enforcer. We help you close open loops, not collect them."
    },
    {
        icon: <Zap size={24} />,
        title: "Capture with Intent",
        description: "Click CAPTURE or paste a link. Our AI analyzes the content instantly so you don't have to guess what's inside."
    },
    {
        icon: <ShieldAlert size={24} />,
        title: "The Confrontation Gate",
        description: "Opening a card triggers a 'Confrontation'. You must decide its fate before you can leave. No more idle hoarding."
    },
    {
        icon: <Timer size={24} />,
        title: "Reality Check",
        description: "We show you exactly how much time has passed since you 'saved' this item. Time is the only resource that matters."
    },
    {
        icon: <Flame size={24} />,
        title: "Execute Mode",
        description: "Choose EXECUTE to commit 15 minutes of deep focus. We'll whitelist the site and block focus breaches automatically."
    },
    {
        icon: <CheckCircle size={24} />,
        title: "The Goal: ZERO",
        description: "Your 'Character State' reflects your mental clarity. Clear your cards to reach a FOCUSED state. Ready to start?"
    }
];

export default function OnboardingGuide({ onComplete }: OnboardingGuideProps) {
    const [currentStep, setCurrentStep] = useState(0);

    const handleNext = () => {
        if (currentStep < STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            onComplete();
        }
    };

    const step = STEPS[currentStep];

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <div className={styles.title}>
                        <Sparkles size={12} />
                        ONBOARDING [{currentStep + 1}/{STEPS.length}]
                    </div>
                </div>

                <div className={styles.body}>
                    <div className={styles.iconContainer}>
                        {step.icon}
                    </div>
                    <h2 className={styles.stepTitle}>{step.title}</h2>
                    <p className={styles.stepDescription}>{step.description}</p>
                </div>

                <div className={styles.footer}>
                    <div className={styles.progress}>
                        {STEPS.map((_, i) => (
                            <div
                                key={i}
                                className={clsx(styles.bullet, i === currentStep && styles.bulletActive)}
                            />
                        ))}
                    </div>

                    <button onClick={handleNext} className={styles.nextButton}>
                        {currentStep === STEPS.length - 1 ? "GET STARTED" : "NEXT STEP"}
                    </button>

                    <button onClick={onComplete} className={styles.skipButton}>
                        Skip Guide
                    </button>
                </div>
            </div>
        </div>
    );
}
