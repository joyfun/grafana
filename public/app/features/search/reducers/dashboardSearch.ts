import { DashboardSection, SearchAction } from '../types';
import { getFlattenedSections, getLookupField, markSelected } from '../utils';
import { FETCH_ITEMS, FETCH_RESULTS, TOGGLE_SECTION, MOVE_SELECTION_DOWN, MOVE_SELECTION_UP } from './actionTypes';

interface State {
  results: DashboardSection[];
  loading: boolean;
  selectedIndex: number;
}

export const initialState: State = {
  results: [],
  loading: true,
  selectedIndex: 0,
};

export const searchReducer = (state: any, action: SearchAction) => {
  switch (action.type) {
    case FETCH_RESULTS: {
      const results = action.payload;
      // Highlight the first item ('Starred' folder)
      if (results.length) {
        results[0].selected = true;
      }
      return { ...state, results, loading: false };
    }
    case TOGGLE_SECTION: {
      const section = action.payload;
      const lookupField = getLookupField(section.title);
      return {
        ...state,
        results: state.results.map((result: DashboardSection) => {
          if (section[lookupField] === result[lookupField]) {
            return { ...result, expanded: !result.expanded };
          }
          return result;
        }),
      };
    }
    case FETCH_ITEMS: {
      const { section, items } = action.payload;
      return {
        ...state,
        results: state.results.map((result: DashboardSection) => {
          if (section.id === result.id) {
            return { ...result, items };
          }
          return result;
        }),
      };
    }
    case MOVE_SELECTION_DOWN: {
      const flatIds = getFlattenedSections(state.results);
      if (state.selectedIndex < flatIds.length - 1) {
        const newIndex = state.selectedIndex + 1;
        const selectedId = flatIds[newIndex];
        return {
          ...state,
          selectedIndex: newIndex,
          results: markSelected(state.results, selectedId),
        };
      }
      return state;
    }
    case MOVE_SELECTION_UP:
      if (state.selectedIndex > 0) {
        const flatIds = getFlattenedSections(state.results);
        const newIndex = state.selectedIndex - 1;
        const selectedId = flatIds[newIndex];
        return {
          ...state,
          selectedIndex: newIndex,
          results: markSelected(state.results, selectedId),
        };
      }
      return state;
    default:
      return state;
  }
};
