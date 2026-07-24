import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, X } from 'lucide-react';
import Button from '../ui/Button';
import { useTraining } from '../../context/TrainingContext';

function getVisibleTarget(selector) {
  if (!selector) return null;
  const nodes = Array.from(document.querySelectorAll(selector));
  return nodes.find((node) => {
    const rect = node.getBoundingClientRect();
    const style = window.getComputedStyle(node);
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  }) || null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export default function TrainingTourOverlay() {
  const {
    activeTour,
    activeStep,
    activeStepIndex,
    totalSteps,
    nextStep,
    previousStep,
    skipTour,
  } = useTraining();
  const [targetRect, setTargetRect] = useState(null);
  const [targetMissing, setTargetMissing] = useState(false);

  useEffect(() => {
    if (!activeStep) return undefined;

    let cancelled = false;

    const updateTarget = () => {
      if (!activeStep.selector) {
        setTargetRect(null);
        setTargetMissing(false);
        return;
      }
      const target = getVisibleTarget(activeStep.selector);
      if (!target) {
        setTargetRect(null);
        setTargetMissing(true);
        return;
      }
      target.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
      window.setTimeout(() => {
        if (cancelled) return;
        const rect = target.getBoundingClientRect();
        setTargetRect({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
        setTargetMissing(false);
      }, 220);
    };

    updateTarget();
    const timer = window.setTimeout(updateTarget, 450);
    window.addEventListener('resize', updateTarget);
    window.addEventListener('scroll', updateTarget, true);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener('resize', updateTarget);
      window.removeEventListener('scroll', updateTarget, true);
    };
  }, [activeStep]);

  const cardStyle = useMemo(() => {
    if (!targetRect) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const cardWidth = Math.min(360, window.innerWidth - 32);
    const below = targetRect.top + targetRect.height + 18;
    const above = targetRect.top - 260;
    const top = below + 250 < window.innerHeight ? below : Math.max(16, above);
    const left = clamp(targetRect.left + targetRect.width / 2 - cardWidth / 2, 16, window.innerWidth - cardWidth - 16);

    return {
      width: cardWidth,
      top,
      left,
    };
  }, [targetRect]);

  if (!activeTour || !activeStep) return null;

  const isLastStep = activeStepIndex >= totalSteps - 1;

  return (
    <div className="fixed inset-0 z-[70] pointer-events-none">
      <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-[1px]" />
      {targetRect && (
        <div
          className="absolute rounded-xl border-2 border-white shadow-[0_0_0_9999px_rgba(15,23,42,0.45),0_0_0_6px_rgba(20,184,166,0.35)] transition-all duration-200"
          style={{
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
          }}
        />
      )}

      <div
        className="pointer-events-auto absolute max-w-[calc(100vw-2rem)] rounded-xl border border-white/70 bg-white p-4 shadow-2xl dark:border-white/10 dark:bg-slate-900"
        style={cardStyle}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--primary)]">
              {activeTour.title}
            </p>
            <h2 className="mt-1 text-base font-black text-gray-950 dark:text-white">{activeStep.title}</h2>
          </div>
          <button
            type="button"
            onClick={skipTour}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-200"
            aria-label="Skip training"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">{activeStep.body}</p>
        {targetMissing && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
            {activeStep.actionHint || 'Open the highlighted form or page action first, then continue. You can also press Next to move through the demo.'}
          </p>
        )}

        <div className="mt-4">
          <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] transition-all"
              style={{ width: `${((activeStepIndex + 1) / totalSteps) * 100}%` }}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-bold text-gray-400">
              Step {activeStepIndex + 1} of {totalSteps}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={skipTour}>Skip</Button>
              <Button variant="secondary" size="sm" onClick={previousStep} disabled={activeStepIndex === 0}>
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
              <Button size="sm" onClick={nextStep}>
                {isLastStep ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
                {isLastStep ? 'Finish' : 'Next'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
