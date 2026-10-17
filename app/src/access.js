'use strict';

const ACCESS_NEEDS = [
  { id: 'write', label: 'Please write down the main points for me.' },
  { id: 'face', label: 'Please face me when you speak.' },
  { id: 'slow', label: 'Please speak slowly.' },
  { id: 'time', label: 'Please give me more time to answer.' },
  { id: 'print', label: 'I read better in large print.' },
  { id: 'simple', label: 'Please use simple words.' },
  { id: 'listen', label: 'I may bring someone to help me listen.' },
  { id: 'tome', label: 'Please talk to me, not only to the person with me.' }
];

const STARTER_QUESTIONS = [
  'Can we go over my medicine list as I wrote it?',
  'Who do I call if I have a question after the visit?',
  'Can you write the main points down for me?',
  'What should I bring next time?'
];

function needLabel(id) {
  const found = ACCESS_NEEDS.find((item) => item.id === id);
  return found ? found.label : null;
}

module.exports = {
  ACCESS_NEEDS,
  STARTER_QUESTIONS,
  needLabel
};
