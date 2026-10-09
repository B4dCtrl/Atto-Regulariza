import React from 'react';
import {Composition} from 'remotion';
import {Cena1} from './Cena1';
export const FPS = 30;
export const DUR = 114;
export const Root: React.FC = () => (
  <Composition id="Cena1" component={Cena1} durationInFrames={DUR} fps={FPS} width={1080} height={1920} />
);
