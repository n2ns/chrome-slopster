import { t } from '@/src/i18n';
import { mountPage } from '@/src/ui/mount';
import App from './App';

mountPage(<App />, t('optionsTitle'));
