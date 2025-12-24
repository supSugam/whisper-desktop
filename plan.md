Now, we will work on a nea branch `whisper-lab` (it is already created and is active), the plan is to add more capabilities to this app, and fix some issues in previous version.

Fix the issues:

1. Auto paste to input was not working even when i was on x11
2. gpu mode was disabled and user was told to just enable vulkan, this is bad cause it is asking user to spend time doing own research instead of guiding properly
3. i havent checked it but on local mode tiny is selected by default so if user use it right away download the model first and also show the download status in voice processing ui so that user is known why their transcription request is taking longer, let them know it is a one time thing as wel
3. improve the model selection ui and item, also the download progress component is weirdly positioned and percentage is always 0 throuhout the enitre download process
4. Audio must be mono, 16kHz, 16-bit WAV error

New features:
- handle autio files
-all previous recording feature, history view all in one page, it will be a modern, clean dashboard like ui, it is a desktop app so ofcourse we dont need to keep the ui so narrow only like using half portion, update the whole layout, for now like direct media handling ie. video and audio, it should efficiently handle high quality audio extraction  in case of audio, research about ideally max duration of file that should the chosen model handle fine, and set limits to not break into an error
- implement very high quality and high precision .SRT generator for given audio, please research the best algorithm and approach for this to generate best subtitle files, that does not miss any voice, any silences, smartly identifying silences, not cutting off voices, writing to srt to ensure perfect readility etc and all
- Since our app is growing quite complex, I think it's clear that we want to switch to react for better state management and reactive UI updates.

the ui will be the same type, we will only improve the reusability and styles but the overall deisng should remain intact without breaking anything, make things component based neatly



this is a huge shift, this will bring a lot of changes in the preojct so please navigate with the best plan. don't try to achieve everyting in one go, in one response, make a perfect plan, with every steps/ divided sub tasks, and do one time at once, then i will review the changes, and say yes or no, then only we move to next sub task