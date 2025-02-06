import { Cheer } from 'jnu-doc';

const parseNextData = (html: string) => {
  const cheer = new Cheer(html);
  return JSON.parse(cheer.value('#__NEXT_DATA__'));
};

const dataFromNextData = (nextData: any) => {
  return nextData.props.apolloState.data;
};

export { parseNextData, dataFromNextData };
