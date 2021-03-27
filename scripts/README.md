# Scripts

_A directory for shell scripts_

...Because I don't like writing Makefiles.

- [`bundle.sh`](https://github.com/ephemer-ai/MT2/blob/dev/scripts/bundle.sh) -
  Takes all the JS and CSS dependencies and packages them into bundle files (see
  the contents of
  [`dist/`](https://github.com/ephemer-ai/MT2/tree/dev/dist)).

- [`compress.sh`](https://github.com/ephemer-ai/MT2/blob/dev/scripts/compress.sh) -
  Generates compressed versions of the largest, most important files to
  MT2. On systems that run
  [`server.js`](https://github.com/ephemer-ai/MT2/blob/dev/server.js), the
  compressed versions will get served, resulting in faster loadtimes.

- [`cleanup.sh`](https://github.com/ephemer-ai/MT2/blob/dev/scripts/compress.sh) -
  Removes all compressed files.

- [`sw.sh`](https://github.com/ephemer-ai/MT2/blob/dev/scripts/sw.sh) -
  Regenerates [`sw.js`](https://github.com/ephemer-ai/MT2/blob/dev/sw.js)
  based on the current contents of the relevant directories.

- [`excise.sh`](https://github.com/ephemer-ai/MT2/blob/dev/scripts/excise.sh) -
  Deletes everything MT2 doesn't need in order to run. **Don't use this
  unless you're deploying to a system with very little free space, or other
  weird constraints.**
