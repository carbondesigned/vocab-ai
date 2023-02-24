import { Component, createEffect, createSignal, onCleanup } from 'solid-js';
import {
  QueryClient,
  QueryClientProvider,
  createQuery,
} from '@tanstack/solid-query';
import { prompts } from '../utils/prompts';
import axios from 'axios';
import api from '../axiosStore';
import { streamToArrayBuffer } from '../utils/streamToArrayBuffer';

const queryClient = new QueryClient();

type Prompt = {
  id: number;
  name: string;
  prompt: string;
  type: string;
};

const App: Component = () => {
  const [prompt, setPrompt] = createSignal('');
  const [streamData, setStreamData] = createSignal('');
  const [displayText, setDisplayText] = createSignal(
    localStorage.getItem('displayText') || ''
  );

  createEffect(() => {
    let controller: AbortController | null = null;

    const payload = {
      model: 'text-davinci-003',
      prompt: prompt() || '',
      max_tokens: 50,
      temperature: 0.7,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      n: 1,
      stream: false,
    };
    if (prompt().length > 0) {
      fetch('https://api.openai.com/v1/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_API_KEY}`,
        },
        body: JSON.stringify(payload),

        // @ts-ignore
        signal: controller?.signal || undefined,
      })
        .then((response) => {
          const stream = response.body;
          const reader = stream?.getReader() as ReadableStreamDefaultReader;
          const decoder = new TextDecoder();

          let chunk = '';

          const readData = () => {
            reader.read().then(({ done, value }) => {
              if (done) {
                return;
              }

              const decodedValue = decoder.decode(value);
              chunk += decodedValue;

              // Split the chunk into individual JSON objects
              const jsonObjects = chunk.split('\n');

              // Extract the 'text' property from the first choice in each JSON object
              jsonObjects.forEach((obj) => {
                if (obj.trim() !== '') {
                  const jsonObject = JSON.parse(obj);
                  const choiceText = jsonObject.choices[0].text;
                  let i = 0;
                  const intervalId = setInterval(() => {
                    setStreamData((currentData) => currentData + choiceText[i]);
                    i++;

                    if (i === choiceText.length) {
                      clearInterval(intervalId);
                    }
                  }, 50);
                }
              });

              // Keep only the last chunk in case it's incomplete
              chunk = jsonObjects[jsonObjects.length - 1];

              readData();
            });
          };

          readData();

          onCleanup(() => {
            reader.cancel();

            // @ts-ignore
            decoder = null;
          });
        })
        .catch((error) => {
          if (error.name === 'AbortError') {
            console.log('Request was aborted.');
          } else {
            console.error('Request failed:', error);
          }
        });

      // Create an AbortController for the fetch request
      controller = new AbortController();

      // Set a timeout to abort the request after 30 seconds
      setTimeout(() => controller?.abort(), 30000);

      // Cleanup function to abort the fetch request and cancel the controller
      onCleanup(() => {
        controller?.abort();
        controller = null;
      });
    }
  });

  createEffect(() => {
    if (localStorage.getItem('displayText') !== null && prompt() === '') {
      // @ts-ignore - this is a hack to get around the fact that I can't get the stream to work
      setDisplayText(localStorage.getItem('displayText'));
    } else {
      setDisplayText(streamData().slice(0, displayText().length + 1));
      localStorage.setItem('displayText', displayText());
    }

    if (localStorage.getItem('displayText')?.length === 0) {
      localStorage.removeItem('displayText');
    }
  });
  return (
    <QueryClientProvider client={queryClient}>
      <>
        <header class='max-w-md md:max-w-2xl mx-auto text-center py-12 px-4 flex flex-col gap-4'>
          <h1 class='text-4xl font-bold'>Vocab AI</h1>
          <p class='text-slate-400'>
            Building a strong vocabulary can be beneficial in many ways,
            including improving communication skills, enhancing critical
            thinking abilities, and boosting confidence.
          </p>
          <div>
            {localStorage.getItem('displayText') === null && (
              <ul class='grid grid-cols-2 md:grid-cols-4 gap-2'>
                {prompts.prompts.map((prompt) => (
                  <li
                    class='bg-slate-900 py-6 rounded-lg border-[0.5px] border-slate-700 grid place-items-center cursor-pointer duration-200 ease-in-out hover:bg-slate-800'
                    onClick={() => {
                      setPrompt(prompt.prompt);
                      setStreamData('');
                    }}
                  >
                    {prompt.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </header>
        <main class='max-w-2xl mx-auto text-center px-4 py-12'>
          {displayText().length > 0 && (
            <p>
              <span class='text-2xl md:text-4xl font-bold'>
                {displayText()}
              </span>
            </p>
          )}
        </main>
      </>
    </QueryClientProvider>
  );
};

export default App;
