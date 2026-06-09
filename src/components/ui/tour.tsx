"use client"

import { AnimatePresence, motion } from "framer-motion"
import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react"
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { HelpCircle } from "lucide-react"

export interface TourStep {
  content: ReactNode
  selectorId: string
  width?: number
  height?: number
  onClickWithinArea?: () => void
  position?: "top" | "bottom" | "left" | "right"
}

interface TourContextType {
  currentStep: number
  totalSteps: number
  nextStep: () => void
  previousStep: () => void
  endTour: () => void
  isActive: boolean
  startTour: () => void
  setSteps: (steps: TourStep[]) => void
  steps: TourStep[]
  isTourCompleted: boolean
  setIsTourCompleted: (completed: boolean) => void
}

interface TourProviderProps {
  children: ReactNode
  onComplete?: () => void
  className?: string
  isTourCompleted?: boolean
}

const TourContext = createContext<TourContextType | null>(null)

const PADDING = 16
const CONTENT_WIDTH = 320
const CONTENT_HEIGHT = 200

function getElementPosition(id: string) {
  const element = document.getElementById(id)
  if (!element) return null
  const rect = element.getBoundingClientRect()
  return {
    top: rect.top + window.scrollY,
    left: rect.left + window.scrollX,
    width: rect.width,
    height: rect.height,
  }
}

function calculateContentPosition(
  elementPos: { top: number; left: number; width: number; height: number },
  position: "top" | "bottom" | "left" | "right" = "bottom",
) {
  let left = elementPos.left
  let top = elementPos.top

  switch (position) {
    case "top":
      top = elementPos.top - CONTENT_HEIGHT - PADDING
      left = elementPos.left + elementPos.width / 2 - CONTENT_WIDTH / 2
      break
    case "bottom":
      top = elementPos.top + elementPos.height + PADDING
      left = elementPos.left + elementPos.width / 2 - CONTENT_WIDTH / 2
      break
    case "left":
      left = elementPos.left - CONTENT_WIDTH - PADDING
      top = elementPos.top + elementPos.height / 2 - CONTENT_HEIGHT / 2
      break
    case "right":
      left = elementPos.left + elementPos.width + PADDING
      top = elementPos.top + elementPos.height / 2 - CONTENT_HEIGHT / 2
      break
  }

  return {
    top,
    left,
    width: CONTENT_WIDTH,
    height: CONTENT_HEIGHT,
  }
}

export function TourProvider({ children, onComplete, className, isTourCompleted = false }: TourProviderProps) {
  const [steps, setSteps] = useState<TourStep[]>([])
  const [currentStep, setCurrentStep] = useState(-1)
  const [elementPosition, setElementPosition] = useState<{
    top: number
    left: number
    width: number
    height: number
  } | null>(null)
  const [isCompleted, setIsCompleted] = useState(isTourCompleted)

  const updateElementPosition = useCallback(() => {
    if (currentStep >= 0 && currentStep < steps.length) {
      const position = getElementPosition(steps[currentStep]?.selectorId ?? "")
      if (position) {
        setElementPosition(position)
      }
    }
  }, [currentStep, steps])

  useEffect(() => {
    updateElementPosition()
    window.addEventListener("resize", updateElementPosition)
    window.addEventListener("scroll", updateElementPosition)

    return () => {
      window.removeEventListener("resize", updateElementPosition)
      window.removeEventListener("scroll", updateElementPosition)
    }
  }, [updateElementPosition])

  const nextStep = useCallback(() => {
    setCurrentStep((prev) => {
      if (prev >= steps.length - 1) {
        setIsCompleted(true)
        onComplete?.()
        return -1
      }
      return prev + 1
    })
  }, [steps.length, onComplete])

  const previousStep = useCallback(() => {
    setCurrentStep((prev) => (prev > 0 ? prev - 1 : prev))
  }, [])

  const endTour = useCallback(() => {
    setCurrentStep(-1)
  }, [])

  const startTour = useCallback(() => {
    if (isCompleted) return
    setCurrentStep(0)
  }, [isCompleted])

  const setIsTourCompletedFn = useCallback((completed: boolean) => {
    setIsCompleted(completed)
  }, [])

  return (
    <TourContext.Provider
      value={{
        currentStep,
        totalSteps: steps.length,
        nextStep,
        previousStep,
        endTour,
        isActive: currentStep >= 0,
        startTour,
        setSteps,
        steps,
        isTourCompleted: isCompleted,
        setIsTourCompleted: setIsTourCompletedFn,
      }}
    >
      {children}
      <AnimatePresence>
        {currentStep >= 0 && elementPosition && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 overflow-hidden bg-black/50"
              style={{
                clipPath: `polygon(
                  0% 0%,
                  0% 100%,
                  100% 100%,
                  100% 0%,

                  ${elementPosition.left}px 0%,
                  ${elementPosition.left}px ${elementPosition.top}px,
                  ${elementPosition.left + (steps[currentStep]?.width || elementPosition.width)}px ${elementPosition.top}px,
                  ${elementPosition.left + (steps[currentStep]?.width || elementPosition.width)}px ${elementPosition.top + (steps[currentStep]?.height || elementPosition.height)}px,
                  ${elementPosition.left}px ${elementPosition.top + (steps[currentStep]?.height || elementPosition.height)}px,
                  ${elementPosition.left}px 0%
                )`,
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                position: "fixed",
                top: elementPosition.top,
                left: elementPosition.left,
                width: elementPosition.width,
                height: elementPosition.height,
                zIndex: 100,
              }}
              className="border-2 border-primary rounded-lg"
            />

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{
                opacity: 1,
                y: 0,
                ...calculateContentPosition(elementPosition, steps[currentStep]?.position),
              }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              exit={{ opacity: 0, y: 10 }}
              style={{
                position: "fixed",
                zIndex: 1000,
                width: CONTENT_WIDTH,
              }}
              className="rounded-lg border bg-background p-4 shadow-lg"
            >
              <div className="absolute right-4 top-2 text-xs text-muted-foreground">
                {currentStep + 1} / {steps.length}
              </div>
              <AnimatePresence mode="wait">
                <div>
                  <motion.div
                    key={`tour-content-${currentStep}`}
                    initial={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
                    animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
                    className="overflow-hidden pt-4"
                    transition={{ duration: 0.2 }}
                  >
                    {steps[currentStep]?.content}
                  </motion.div>
                  <div className="mt-4 flex justify-between">
                    {currentStep > 0 && (
                      <Button
                        onClick={previousStep}
                        variant="ghost"
                        disabled={currentStep === 0}
                        className="text-sm"
                      >
                        Anterior
                      </Button>
                    )}
                    <Button
                      onClick={nextStep}
                      variant="ghost"
                      className={cn("text-sm", !currentStep && "ml-auto")}
                    >
                      {currentStep === steps.length - 1 ? "Concluir" : "Próximo"}
                    </Button>
                  </div>
                </div>
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </TourContext.Provider>
  )
}

export function useTour() {
  const context = useContext(TourContext)
  if (!context) {
    throw new Error("useTour must be used within a TourProvider")
  }
  return context
}

export function TourAlertDialog({ isOpen, setIsOpen }: { isOpen: boolean; setIsOpen: (isOpen: boolean) => void }) {
  const { startTour, steps, isTourCompleted, currentStep } = useTour()

  if (isTourCompleted || steps.length === 0 || currentStep > -1) {
    return null
  }

  const handleSkip = () => {
    setIsOpen(false)
  }

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="max-w-md p-6">
        <AlertDialogHeader className="flex flex-col items-center justify-center">
          <div className="relative mb-4">
            <motion.div
              initial={{ scale: 0.7, filter: "blur(10px)" }}
              animate={{
                scale: 1,
                filter: "blur(0px)",
                y: [0, -8, 0],
              }}
              transition={{
                duration: 0.4,
                ease: "easeOut",
                y: {
                  duration: 2.5,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "easeInOut",
                },
              }}
            >
              <HelpCircle className="h-16 w-16 text-primary" />
            </motion.div>
          </div>
          <AlertDialogTitle className="text-center text-xl font-medium">
            Bem-vindo ao Ato Regulariza!
          </AlertDialogTitle>
          <AlertDialogDescription className="mt-2 text-center text-sm">
            Vamos mostrar como usar a plataforma para regularizar seu imóvel de forma rápida e fácil.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="mt-6 space-y-3">
          <Button onClick={startTour} className="w-full">
            Iniciar Tour
          </Button>
          <Button onClick={handleSkip} variant="ghost" className="w-full">
            Pular por enquanto
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function TourHelpButton() {
  const { startTour, isTourCompleted } = useTour()

  if (isTourCompleted) return null

  return (
    <button
      onClick={startTour}
      className="fixed bottom-6 right-6 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg transition-transform hover:scale-110"
      title="Rever tutorial"
    >
      <HelpCircle className="h-5 w-5" />
    </button>
  )
}
