import { CheckCircle2, Clock3, GraduationCap, LockKeyhole, PlayCircle, RotateCcw, Sparkles } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { getTrainingTourSteps, isTrainingTourAvailable, useTraining } from '../../context/TrainingContext';
import { useClinic } from '../../context/ClinicContext';

export default function TrainingCenter() {
  const {
    tours,
    centerOpen,
    closeTrainingCenter,
    startTour,
    completedTours,
    skippedTours,
    resetTrainingProgress,
  } = useTraining();
  const { features } = useClinic();

  const availableCount = tours.filter(tour => isTrainingTourAvailable(tour, features)).length;

  return (
    <Modal isOpen={centerOpen} onClose={closeTrainingCenter} title="Training Center" size="xl">
      <div className="space-y-5">
        <div className="rounded-xl border border-teal-100 bg-teal-50/70 p-4 dark:border-teal-500/20 dark:bg-teal-500/10">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[var(--primary)] shadow-sm dark:bg-white/10">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-black text-gray-900 dark:text-white">Replayable demo and role training</p>
              <p className="mt-1 text-xs leading-5 text-gray-600 dark:text-gray-300">
                Use guided flows to train new clinic staff. Starter users get core workflow training; growth modules appear when the clinic package includes them.
              </p>
              <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700 dark:text-teal-300">
                {availableCount} of {tours.length} courses available for this package
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3">
          {tours.map((tour) => {
            const completed = completedTours.includes(tour.id);
            const skipped = skippedTours.includes(tour.id);
            const available = isTrainingTourAvailable(tour, features);
            const steps = getTrainingTourSteps(tour, features);
            return (
              <div
                key={tour.id}
                className={`rounded-xl border p-4 shadow-sm ${
                  available
                    ? 'border-gray-100 bg-white dark:border-white/10 dark:bg-white/5'
                    : 'border-dashed border-gray-200 bg-gray-50/70 opacity-85 dark:border-white/10 dark:bg-white/[0.03]'
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-black text-gray-900 dark:text-white">{tour.title}</p>
                      {!available && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500 ring-1 ring-gray-200 dark:bg-white/10 dark:text-gray-300 dark:ring-white/10">
                          <LockKeyhole className="h-3 w-3" /> Locked
                        </span>
                      )}
                      {completed && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20">
                          <CheckCircle2 className="h-3 w-3" /> Completed
                        </span>
                      )}
                      {!completed && skipped && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20">
                          Skipped
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
                      {available ? tour.description : (tour.lockedDescription || tour.description)}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400">
                      <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" /> {tour.duration}</span>
                      <span>{tour.plan}</span>
                      {tour.audience && <span>{tour.audience}</span>}
                      <span>{steps.length} steps</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={completed || !available ? 'secondary' : 'primary'}
                    onClick={() => startTour(tour.id)}
                    disabled={!available}
                    className="justify-center sm:shrink-0"
                  >
                    {!available ? <LockKeyhole className="h-4 w-4" /> : completed ? <RotateCcw className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                    {!available ? 'Locked' : completed ? 'Replay' : 'Start'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 border-t border-gray-100 pt-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Sparkles className="h-4 w-4 text-[var(--primary)]" />
            Training can now expand by plan without showing users routes their package cannot access.
          </div>
          <Button variant="ghost" size="sm" onClick={resetTrainingProgress}>Reset progress</Button>
        </div>
      </div>
    </Modal>
  );
}
