import React, { useEffect, useState } from "react";
import Link from 'next/link';
import { createUseStyles } from "react-jss";
import getFlag from "../../lib/getFlag";
import { getFriends } from "../../services/friends";
import { getGameList, getGameSorts } from "../../services/games";
import { multiGetUniverseIcons } from "../../services/thumbnails";
import AuthenticationStore from "../../stores/authentication";
import GamesPageStore from "../../stores/gamesPage";
import AdSkyscraper from "../ad/adSkyscraper"
import Games from "../gamesPage";
import GameRow from "../gamesPage/components/gameRow";
import PlayerHeadshot from "../playerHeadshot";
import useCardStyles from "../userProfile/styles/card";
import FriendEntry from "./components/friendEntry";
import MyFeed from "./components/myFeed";
import DashboardStore from "./stores/dashboardStore";

const useStyles = createUseStyles({
  container: {
    maxWidth: '1200px!Important',
  },
  headshotWrapper: {
    borderRadius: '100%',
    overflow: 'hidden',
    background: 'white',
    border: '1px solid #c3c3c3',
    boxShadow: '0 -5px 20px rgba(25,25,25,0.15)',
  },
  helloMessage: {
    fontWeight: 600,
    fontSize: '40px',
    // marginTop: '40px',
    '@media(min-width: 980px)': {
      marginTop: '60px',
      marginLeft: '20px',
    }
  },
  subHeader: {
    fontWeight: 300,
    fontSize: '24px',
    color: '#4a4a4a',
  },
  card: {
    boxShadow: '0 -5px 20px rgba(25,25,25,0.15)',
  },
  friendRow: {
    flexFlow: 'row',
    marginRight: '-7px',
    overflow: 'auto',
  },
  mainBody: {
    background: '#e3e3e3',
  },
});

const MyDashboard = props => {
  const s = useStyles();
  const cardStyles = useCardStyles();
  const auth = AuthenticationStore.useContainer();
  const { friends, setFriends, friendStatus } = DashboardStore.useContainer();
  const [gameSorts, setGameSorts] = useState(null);
  const [icons, setIcons] = useState({});
  useEffect(() => {
    if (!auth.userId) return;
    getFriends({
      userId: auth.userId,
    }).then(d => {
      if (d.length > 0) {
        setFriends(d);
      }
    });
  }, [auth.userId]);

  useEffect(() => {
    getGameSorts({
      gameSortsContext: 'HomeSorts',
    }).then(sorts => {
      let proms = [];
      let gamesList = [];
      let idsForIcons = [];
      for (const item of sorts.sorts) {
        gamesList.push(item);
        proms.push(
          getGameList({
            sortToken: item.token,
            limit: 100,
            keyword: '',
          }).then(games => {
            item.games = games.games;
            games.games.forEach(v => idsForIcons.push(v.universeId));
          })
        )
      }
      Promise.all(proms).then(() => {
        setGameSorts(gamesList);
        multiGetUniverseIcons({
          universeIds: idsForIcons,
          size: '150x150',
        }).then(icons => {
          let obj = {};
          for (const key of icons) { obj[key.targetId] = key.imageUrl };
          setIcons(obj);
        })
      })
    })
  }, []);

  if (!auth.userId && auth.isPending) return null;
  return <div className={'container ' + s.container}>
    <div className='row'>
      <div className='d-none d-lg-flex col-2'><AdSkyscraper context='dashboard-left' /></div>
      <div className={'col-12 col-lg-8 ' + s.mainBody}>
        <div className='row'>
          <div className='col-3'>
            <div className={s.headshotWrapper}>
              {auth.userId ? <PlayerHeadshot id={auth.userId} name={auth.username} /> : null}
            </div>
          </div>
          <div className='col-9'>
            <h3 className={s.helloMessage}>{auth.userId ? `Hello, ${auth.username}!` : 'Welcome to Economy Simulator!'}</h3>
            {!auth.userId ? <p style={{ fontSize: '16px', color: '#666' }}>
              <Link href='/Login/Signup.aspx'><a>Sign up</a></Link> or <Link href='/Login/Auth.aspx'><a>log in</a></Link> to customize your avatar, play games, and hang out with friends.
            </p> : null}
          </div>
        </div>
        {friends && auth.userId && <div className='row mt-4'>
          <div className='col-12'>
            <h3 className={s.subHeader}>Friends ({friends.length})</h3>
            <div className={'card pt-3 pb-3 ps-3 pe-2 ' + s.card}>
              <div className={'row ' + s.friendRow}>
                {
                  friends.map(v => {
                    return <FriendEntry key={v.id} {...v} />
                  })
                }
              </div>
            </div>
          </div>
        </div>
        }
        {
          gameSorts && gameSorts.map(v => {
            return <GameRow key={v.token} title={v.displayName} games={v.games} icons={icons} />
          })
        }
        {getFlag('userFeedEnabled', false) ? <div className='row mt-4'>
          <div className='col-12 col-md-6'>
            <div className={cardStyles.card}>
              <div className='p-2'>
                <h3 className={s.subHeader}>MY FEED</h3>
                <MyFeed />
              </div>
            </div>
          </div>
        </div> : null}
      </div>
      <div className='d-none d-lg-flex col-2'><AdSkyscraper context='dashboard-right'></AdSkyscraper></div>
    </div>
  </div>
}

export default MyDashboard;