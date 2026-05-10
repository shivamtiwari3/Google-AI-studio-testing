/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { BookOpen, Sparkles, Volume2, ArrowRight, ArrowLeft, RotateCcw, Loader2, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';

// Types
interface Page {
  text: string;
  illustrationPrompt: string;
}

interface Story {
  title: string;
  pages: Page[];
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function App() {
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [story, setStory] = useState<Story | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [images, setImages] = useState<Record<number, string>>({});
  const [audioLoading, setAudioLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const generateStory = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setStory(null);
    setImages({});
    setCurrentPage(0);

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Create a magical and fun 5-page story for children about "${topic}". 
        The story should be engaging, educational, and have a clear beginning, middle, and end.
        Return the result as a JSON object with a 'title' and a 'pages' array where each page has 'text' and 'illustrationPrompt'.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              pages: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    text: { type: Type.STRING },
                    illustrationPrompt: { type: Type.STRING, description: "A detailed description for an artist to draw this scene. Include style like 'whimsical watercolor illustration for a children's book'." }
                  },
                  required: ["text", "illustrationPrompt"]
                },
                minItems: 5,
                maxItems: 5
              }
            },
            required: ["title", "pages"]
          }
        }
      });

      const storyData = JSON.parse(response.text.trim()) as Story;
      setStory(storyData);
      
      // Generate the first page's illustration immediately
      generateIllustration(0, storyData.pages[0].illustrationPrompt);
    } catch (error) {
      console.error("Story generation failed:", error);
      alert("Oops! The magic wand stalled. Try another story idea!");
    } finally {
      setLoading(false);
    }
  };

  const generateIllustration = async (index: number, prompt: number | string) => {
    if (images[index]) return; // Already generated

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { text: `A whimsical, colorful, and high-quality children's book illustration: ${prompt}` },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: "1:1"
          }
        }
      });

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          setImages(prev => ({ ...prev, [index]: imageUrl }));
          return;
        }
      }
    } catch (error) {
      console.error("Illustration generation failed:", error);
      // Fallback placeholder
      setImages(prev => ({ ...prev, [index]: `https://picsum.photos/seed/story-${index}/600/600` }));
    }
  };

  const playSpeech = async (text: string) => {
    if (audioLoading) return;
    setAudioLoading(true);

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: `Read this story page with a kind, storyteller voice for kids: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioSrc = `data:audio/wav;base64,${base64Audio}`;
        if (audioRef.current) {
          audioRef.current.src = audioSrc;
          audioRef.current.play();
        }
      }
    } catch (error) {
      console.error("Speech generation failed:", error);
      // Fallback to Web Speech API
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    } finally {
      setAudioLoading(false);
    }
  };

  useEffect(() => {
    if (story && story.pages[currentPage]) {
      generateIllustration(currentPage, story.pages[currentPage].illustrationPrompt);
    }
  }, [currentPage, story]);

  const nextPage = () => {
    if (story && currentPage < story.pages.length - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const reset = () => {
    setStory(null);
    setTopic('');
    setImages({});
    setCurrentPage(0);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 space-y-8 max-w-5xl mx-auto">
      <audio ref={audioRef} hidden />

      {/* Header */}
      <motion.header 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-center space-y-2"
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <BookOpen className="w-10 h-10 text-secondary" />
          <h1 className="text-4xl md:text-6xl font-bold text-[#2D3436] tracking-tight">
            Story<span className="text-accent underline decoration-primary decoration-4 underline-offset-4">Spark</span>
          </h1>
        </div>
        <p className="text-lg text-[#636E72] font-medium italic">Generating magical moments, one page at a time.</p>
      </motion.header>

      <main className="w-full flex-1 flex flex-col items-center justify-center">
        {!story ? (
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-xl space-y-6 glass-panel p-8 rounded-3xl book-shadow border-4 border-primary"
            id="input-container"
          >
            <div className="space-y-4">
              <label htmlFor="topic-input" className="block text-xl font-bold flex items-center gap-2">
                <Sparkles className="text-primary" /> What should our story be about?
              </label>
              <textarea
                id="topic-input"
                className="w-full h-32 p-4 rounded-2xl border-2 border-[#DFE6E9] focus:border-accent focus:ring-accent outline-none text-lg resize-none transition-all"
                placeholder="e.g., A robot who learns to paint, or a cat exploring space..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>

            <button
              id="magic-btn"
              onClick={generateStory}
              disabled={loading || !topic.trim()}
              className="w-full group relative overflow-hidden bg-primary hover:bg-[#F39C12] disabled:bg-[#DFE6E9] text-[#2D3436] font-bold py-6 rounded-2xl text-2xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin w-8 h-8" />
                  Painting the magic...
                </>
              ) : (
                <>
                  <Sparkles className="group-hover:animate-bounce" />
                  Spark the Story!
                </>
              )}
            </button>
          </motion.div>
        ) : (
          <div className="w-full space-y-6" id="story-reader">
            {/* Story Viewer */}
            <div className="flex flex-col lg:flex-row gap-8 items-start">
              {/* Illustration Pane */}
              <div className="w-full lg:w-1/2 aspect-square relative rounded-3xl overflow-hidden book-shadow bg-white border-8 border-white">
                <AnimatePresence mode="wait">
                  {images[currentPage] ? (
                    <motion.img
                      key={currentPage}
                      initial={{ opacity: 0, scale: 1.1 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.8 }}
                      src={images[currentPage]}
                      alt="Story illustration"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-gray-50">
                      <Loader2 className="w-12 h-12 animate-spin text-accent" />
                      <p className="font-bold text-accent animate-pulse">Painting your scene...</p>
                    </div>
                  )}
                </AnimatePresence>
                
                {/* Page Indicator Badge */}
                <div className="absolute top-4 right-4 bg-primary px-4 py-2 rounded-full font-bold shadow-lg border-2 border-white">
                  Page {currentPage + 1} of {story.pages.length}
                </div>
              </div>

              {/* Text Pane */}
              <div className="w-full lg:w-1/2 flex flex-col space-y-6 h-full justify-between">
                <div className="glass-panel p-8 rounded-3xl book-shadow min-h-[300px] flex flex-col">
                  {currentPage === 0 && (
                    <motion.h2 
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-3xl font-bold text-accent mb-6"
                    >
                      {story.title}
                    </motion.h2>
                  )}
                  <div className="flex-1">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={currentPage}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="text-xl md:text-2xl leading-relaxed font-serif text-[#2D3436] prose prose-xl"
                      >
                        <ReactMarkdown>{story.pages[currentPage].text}</ReactMarkdown>
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  <div className="mt-8 flex items-center gap-4">
                    <button
                      id="read-aloud-btn"
                      onClick={() => playSpeech(story.pages[currentPage].text)}
                      disabled={audioLoading}
                      className="flex items-center gap-2 bg-secondary text-white px-6 py-3 rounded-full font-bold hover:bg-[#FF5252] transition-colors shadow-md active:scale-95 disabled:opacity-50"
                    >
                      {audioLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Volume2 className="w-5 h-5" />
                      )}
                      {audioLoading ? "Preparing..." : "Read Aloud"}
                    </button>
                    
                    <button
                      id="play-all-btn"
                      className="p-3 bg-white rounded-full text-accent shadow-md hover:bg-accent hover:text-white transition-all"
                      title="Play magical sound"
                    >
                      <Sparkles className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-between w-full">
                  <button
                    id="prev-btn"
                    onClick={prevPage}
                    disabled={currentPage === 0}
                    className="p-4 rounded-2xl bg-white border-2 border-[#DFE6E9] disabled:opacity-30 enabled:hover:border-accent transition-all shadow-sm active:scale-90"
                  >
                    <ArrowLeft className="w-8 h-8" />
                  </button>

                  <div className="flex gap-4">
                    <button
                      id="reset-btn"
                      onClick={reset}
                      className="flex items-center gap-2 bg-[#FEE2E2] text-secondary px-6 py-4 rounded-2xl font-bold hover:bg-secondary hover:text-white transition-all"
                    >
                      <RotateCcw className="w-5 h-5" />
                      Start New Story
                    </button>

                    {currentPage < story.pages.length - 1 ? (
                      <button
                        id="next-btn"
                        onClick={nextPage}
                        className="bg-accent text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2 shadow-lg hover:bg-[#3A86FF] transition-all active:scale-95 group"
                      >
                        Next Page
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </button>
                    ) : (
                      <button
                        id="finish-btn"
                        onClick={reset}
                        className="bg-success text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2 shadow-lg hover:opacity-90 transition-all active:scale-95"
                      >
                        The End! Play Again?
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer / Stats */}
      <footer className="w-full text-center py-4 border-t border-[#DFE6E9] opacity-70">
        <p className="text-sm font-medium flex items-center justify-center gap-2">
          Made with <Sparkles className="w-4 h-4 text-primary" /> for curious little minds
        </p>
      </footer>
    </div>
  );
}
