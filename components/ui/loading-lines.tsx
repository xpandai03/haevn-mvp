'use client'

import React from "react";

const LoadingLines: React.FC = () => {
  const letters = "Loading".split("");

  return (
    <>
      <style>
        {`
          @keyframes loadingLetterAnim {
            0% { opacity: 0; }
            5% { opacity: 1; text-shadow: 0 0 4px #fff; transform: scale(1.1) translateY(-2px); }
            20% { opacity: 0.2; }
            100% { opacity: 0; }
          }
          @keyframes loadingTransformAnim {
            0% { transform: translate(-55%); }
            100% { transform: translate(55%); }
          }
          @keyframes loadingOpacityAnim {
            0%, 100% { opacity: 0; }
            15% { opacity: 1; }
            65% { opacity: 0; }
          }
          .loading-letter {
            animation: loadingLetterAnim 4s linear infinite;
          }
          .loading-bg-anim {
            animation: loadingTransformAnim 2s infinite alternate cubic-bezier(0.6, 0.8, 0.5, 1), loadingOpacityAnim 4s infinite;
          }
        `}
      </style>
      <div className="relative flex items-center justify-center h-[120px] w-auto m-8 text-[1.6em] font-semibold select-none scale-[2]">
        {/* Animated letters */}
        {letters.map((letter, idx) => (
          <span
            key={idx}
            className="loading-letter relative inline-block opacity-0 z-[2] text-haevn-navy"
            style={{ animationDelay: `${0.1 + idx * 0.105}s` }}
          >
            {letter}
          </span>
        ))}

        {/* Loader background */}
        <div
          className="absolute top-0 left-0 w-full h-full z-[1] bg-transparent"
          style={{ mask: 'repeating-linear-gradient(90deg, transparent 0, transparent 6px, black 7px, black 8px)' }}
        >
          <div
            className="loading-bg-anim absolute top-0 left-0 w-full h-full"
            style={{
              backgroundImage: 'radial-gradient(circle at 50% 50%, #1B9A9A 0%, transparent 50%), radial-gradient(circle at 45% 45%, #0F2A4A 0%, transparent 45%), radial-gradient(circle at 55% 55%, #1B9A9A 0%, transparent 45%), radial-gradient(circle at 45% 55%, #0F2A4A 0%, transparent 45%), radial-gradient(circle at 55% 45%, #1B9A9A 0%, transparent 45%)',
              mask: 'radial-gradient(circle at 50% 50%, transparent 0%, transparent 10%, black 25%)'
            }}
          />
        </div>
      </div>
    </>
  );
};

export default LoadingLines;
